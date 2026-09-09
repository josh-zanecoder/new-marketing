import type { AnyBulkWriteOperation } from 'mongoose'
import {
  ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY,
  ZC_MAIL_ARCHIVE_DETAIL_MAX,
  ZC_MAIL_ARCHIVE_LIST_PAGE_CONCURRENCY,
  ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_CONCURRENCY,
  ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_MAX,
  ZC_MAIL_ARCHIVE_STATS_MAX_PAGES,
  ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT,
  ZC_MAIL_ARCHIVE_TENANT_WIDE_MAX_PAGES
} from '@server/constants/zcMailWebhook'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  brevoEventToTrackingDoc,
  type SyncTenantBrevoTrackingEventsResult
} from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import {
  dedupeBrevoTrackingEvents,
  ensureBrevoTrackingIndexes
} from '@server/utils/tracking/dedupeBrevoTrackingEvents'
import {
  mapZcMailArchiveItemToTrackingEvents,
  withScopedZcMailArchiveTags,
  zcMailArchiveBelongsToScope,
  zcMailArchiveInDateRange,
  zcMailArchiveLookupIds
} from '@server/utils/tracking/mapZcMailArchiveToTrackingEvents'
import {
  getZcMailArchiveById,
  listZcMailArchive
} from '@server/utils/zcmail/zcMailArchiveClient'
import { findEmailMessageRoutingMap } from '@server/utils/zcmail/emailMessageRouting'
import { zcMailArchiveCampaignSearchTerms, CAMPAIGN_TEST_EMAIL_TAG_RE } from '@server/utils/zcmail/campaignZcMailTags'
import type { ZcMailSendConfig } from '@server/utils/zcmail/resolveTenantEmailSendConfig'
import type {
  ZcMailArchiveDetail,
  ZcMailArchiveListItem
} from '@server/utils/zcmail/types/zcMailArchive'
import { ZcMailSendError } from '@server/utils/zcmail/sendZcMailEmail'

const BULK_CHUNK = 1000

const inflightSyncs = new Map<string, Promise<SyncTenantBrevoTrackingEventsResult>>()

export type ZcMailArchiveTrackingClient = {
  list: typeof listZcMailArchive
  getById: typeof getZcMailArchiveById
}

function syncKey(params: {
  dbName: string
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
}): string {
  return [
    'zcmail',
    params.dbName.trim(),
    params.campaignId?.trim() || '',
    params.fromYmd?.trim() || '',
    params.toYmd?.trim() || ''
  ].join('|')
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      out[index] = await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
  return out
}

async function loadArchivesInRange(params: {
  client: ZcMailArchiveTrackingClient
  baseUrl: string
  apiKey: string
  tenantName: string
  fromYmd?: string | null
  toYmd?: string | null
  q?: string
  campaign?: string
  maxPages?: number
  /** When set, only keep rows that match (and optionally abort early — see below). */
  matchMessageIds?: Set<string>
  /**
   * With matchMessageIds: stop after the first in-range page with zero matches.
   * Use for campaign/tag probes that return the wrong mailbox. Do NOT use for
   * tenant-wide scans looking for older campaign rows under newer volume.
   */
  abortIfNoMessageIdMatch?: boolean
  /** Keep only matchMessageIds hits (tenant scan / large-campaign backfill). */
  keepMatchedOnly?: boolean
}): Promise<ZcMailArchiveListItem[]> {
  const collected: ZcMailArchiveListItem[] = []
  const maxPages = params.maxPages ?? ZC_MAIL_ARCHIVE_STATS_MAX_PAGES
  const pageConcurrency = Math.max(1, ZC_MAIL_ARCHIVE_LIST_PAGE_CONCURRENCY)
  const targetUnique = params.matchMessageIds?.size
    ? uniqueStrippedMessageIds(params.matchMessageIds).length
    : 0
  const foundUnique = new Set<string>()

  for (let page = 0; page < maxPages; ) {
    const wave = Math.min(pageConcurrency, maxPages - page)
    const batches = await Promise.all(
      Array.from({ length: wave }, (_, i) => {
        const skip = (page + i) * ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT
        return params.client.list({
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
          tenantName: params.tenantName,
          limit: ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT,
          skip,
          q: params.q,
          campaign: params.campaign
        })
      })
    )

    let stop = false
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]!
      if (batch.items.length === 0) {
        stop = true
        break
      }

      let reachedBeforeRange = false
      let inRangeOnPage = 0
      let matchedOnPage = 0
      for (const item of batch.items) {
        if (!zcMailArchiveInDateRange(item.createdAt, params.fromYmd, params.toYmd)) {
          const day = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ''
          if (params.fromYmd && day && day < params.fromYmd) reachedBeforeRange = true
          continue
        }
        inRangeOnPage += 1
        const matched =
          !!params.matchMessageIds?.size &&
          archiveItemMatchesMessageIds(item, params.matchMessageIds)
        if (matched) {
          matchedOnPage += 1
          for (const id of zcMailArchiveLookupIds(item)) {
            const stripped = id.replace(/^<|>$/g, '').trim()
            if (stripped) foundUnique.add(stripped)
          }
        }
        if (params.keepMatchedOnly) {
          if (matched) collected.push(item)
        } else {
          collected.push(item)
        }
      }

      if (
        params.abortIfNoMessageIdMatch &&
        params.matchMessageIds?.size &&
        inRangeOnPage > 0 &&
        matchedOnPage === 0 &&
        foundUnique.size === 0
      ) {
        stop = true
        break
      }

      if (targetUnique > 0 && foundUnique.size >= targetUnique) {
        stop = true
        break
      }

      if (batch.items.length < ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT) {
        stop = true
        break
      }
      if (reachedBeforeRange) {
        const oldest = batch.items[batch.items.length - 1]?.createdAt || ''
        const oldestDay = oldest ? new Date(oldest).toISOString().slice(0, 10) : ''
        if (params.fromYmd && oldestDay && oldestDay < params.fromYmd) {
          stop = true
          break
        }
      }
    }

    page += wave
    if (stop) break
  }
  return uniqueArchiveItems(collected)
}

function archiveItemMatchesMessageIds(
  item: ZcMailArchiveListItem,
  messageIds: Set<string>
): boolean {
  if (!messageIds.size) return false
  for (const id of zcMailArchiveLookupIds(item)) {
    if (messageIds.has(id)) return true
    const stripped = id.replace(/^<|>$/g, '')
    if (stripped && messageIds.has(stripped)) return true
  }
  return false
}

function uniqueStrippedMessageIds(messageIds: Set<string>): string[] {
  const unique = new Set<string>()
  for (const id of messageIds) {
    const stripped = id.replace(/^<|>$/g, '').trim()
    if (stripped) unique.add(stripped)
  }
  return [...unique]
}

/**
 * Parallel archive `q=<sesMessageId>` lookups. Capped — never unbounded fan-out.
 */
async function loadArchivesByMessageIdQueries(params: {
  client: ZcMailArchiveTrackingClient
  baseUrl: string
  apiKey: string
  tenantName: string
  fromYmd?: string | null
  toYmd?: string | null
  messageIds: Set<string>
}): Promise<ZcMailArchiveListItem[]> {
  const allIds = uniqueStrippedMessageIds(params.messageIds)
  if (allIds.length === 0) return []
  const ids = allIds.slice(0, ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_MAX)
  if (allIds.length > ids.length) {
    console.warn('[zcMail tracking] capping message-id q lookups', {
      total: allIds.length,
      capped: ids.length
    })
  }

  const batches = await mapPool(ids, ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_CONCURRENCY, async (messageId) => {
    try {
      const batch = await params.client.list({
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        tenantName: params.tenantName,
        limit: 5,
        skip: 0,
        q: messageId
      })
      return batch.items.filter(
        (item) =>
          zcMailArchiveInDateRange(item.createdAt, params.fromYmd, params.toYmd) &&
          archiveItemMatchesMessageIds(item, params.messageIds)
      )
    } catch {
      return [] as ZcMailArchiveListItem[]
    }
  })
  return uniqueArchiveItems(batches.flat())
}

function routingHitForItem(
  item: ZcMailArchiveListItem,
  routing: Map<string, { dbName: string; campaignId: string; userEmail: string }>
): { dbName: string; campaignId: string; userEmail: string } | null {
  for (const id of zcMailArchiveLookupIds(item)) {
    const hit = routing.get(id)
    if (hit) return hit
  }
  return null
}

async function loadCampaignOperatorUserEmail(
  dbName: string,
  campaignId: string
): Promise<string> {
  try {
    const conn = await getTenantConnectionByDbName(dbName)
    const { Campaign } = getTenantClientModels(conn)
    const doc = (await Campaign.findById(campaignId)
      .select({ mergeUserSnapshot: 1 })
      .lean()
      .exec()) as { mergeUserSnapshot?: { email?: string } } | null
    const email = String(doc?.mergeUserSnapshot?.email || '')
      .trim()
      .toLowerCase()
    return email.includes('@') ? email : ''
  } catch {
    return ''
  }
}

async function loadCampaignRecipientMatchIndex(
  dbName: string,
  campaignId: string
): Promise<Set<string>> {
  const messageIds = new Set<string>()
  const conn = await getTenantConnectionByDbName(dbName)
  const { CampaignRecipient } = getTenantClientModels(conn)
  const docs = (await CampaignRecipient.find({ campaign: campaignId })
    .select({ brevoMessageId: 1 })
    .lean()
    .exec()) as Array<{ brevoMessageId?: string }>
  for (const doc of docs) {
    const messageId = String(doc.brevoMessageId || '').trim()
    if (messageId) {
      messageIds.add(messageId)
      const stripped = messageId.replace(/^<|>$/g, '')
      if (stripped) messageIds.add(stripped)
    }
  }
  return messageIds
}

function uniqueArchiveItems(items: ZcMailArchiveListItem[]): ZcMailArchiveListItem[] {
  const seen = new Set<string>()
  const out: ZcMailArchiveListItem[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

const ENGAGEMENT_EVENTS = ['opened', 'unique_opened', 'open', 'opens', 'clicks', 'click'] as const

/**
 * Message ids that already have open/click rows in Mongo — skip archive detail GET on Refresh.
 * List-row status (sent/delivered/bounce) is still upserted without detail.
 */
async function loadAlreadyEnrichedMessageIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BrevoTrackingEvent: any,
  messageIds: string[]
): Promise<Set<string>> {
  const ids = [...new Set(messageIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return new Set()
  const enriched = new Set<string>()
  const CHUNK = 500
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const docs = (await BrevoTrackingEvent.find({
      messageId: { $in: slice },
      event: { $in: [...ENGAGEMENT_EVENTS] }
    })
      .select({ messageId: 1 })
      .lean()
      .exec()) as Array<{ messageId?: string }>
    for (const doc of docs) {
      const id = String(doc.messageId || '').trim()
      if (id) enriched.add(id)
    }
  }
  return enriched
}

async function loadCampaignArchivesFast(params: {
  client: ZcMailArchiveTrackingClient
  baseUrl: string
  apiKey: string
  tenantName: string
  fromYmd?: string | null
  toYmd?: string | null
  campaignId: string
  matchMessageIds?: Set<string>
}): Promise<{ items: ZcMailArchiveListItem[]; usedTenantListFallback: boolean }> {
  const listBase = {
    client: params.client,
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    tenantName: params.tenantName,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd,
    campaign: params.campaignId,
    matchMessageIds: params.matchMessageIds,
    abortIfNoMessageIdMatch: true
  }
  // Campaign + tag query params already scope the list. Also run a couple of `q`
  // searches in parallel for older archive rows — never one HTTP call per recipient
  // on the happy path.
  const searchTerms = zcMailArchiveCampaignSearchTerms(params.campaignId)
  const batches = await Promise.all([
    loadArchivesInRange(listBase),
    ...searchTerms.map((q) => loadArchivesInRange({ ...listBase, q }))
  ])
  const tagged = uniqueArchiveItems(batches.flat())
  if (tagged.length > 0) return { items: tagged, usedTenantListFallback: false }

  // Empty campaign/tag filter: do not page the whole tenant here. Caller fills via
  // parallel message-id `q` when CampaignRecipient ids exist.
  console.warn('[zcMail tracking] campaign archive filter empty; will use message-id lookup', {
    campaignId: params.campaignId,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd
  })
  return { items: [], usedTenantListFallback: false }
}

/**
 * Pull zcMail archive (+ SES events on detail) into tenant `brevo_tracking_events`.
 * Webhooks stay the live path; Refresh gap-fills delivered/failed/opens/clicks.
 */
export async function syncTenantZcMailTrackingEvents(params: {
  dbName: string
  config: ZcMailSendConfig
  fromYmd?: string | null
  toYmd?: string | null
  campaignId?: string | null
  archiveClient?: ZcMailArchiveTrackingClient
}): Promise<SyncTenantBrevoTrackingEventsResult> {
  const dbName = params.dbName.trim()
  if (!dbName) {
    return { fetched: 0, upserted: 0, modified: 0, timingsMs: { total: 0 }, error: 'Missing tenant database' }
  }

  const key = syncKey({
    dbName,
    campaignId: params.campaignId,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd
  })
  const existing = inflightSyncs.get(key)
  if (existing) return existing

  const promise = runZcMailArchiveSync(params).finally(() => {
    inflightSyncs.delete(key)
  })
  inflightSyncs.set(key, promise)
  return promise
}

async function runZcMailArchiveSync(params: {
  dbName: string
  config: ZcMailSendConfig
  fromYmd?: string | null
  toYmd?: string | null
  campaignId?: string | null
  archiveClient?: ZcMailArchiveTrackingClient
}): Promise<SyncTenantBrevoTrackingEventsResult> {
  const started = Date.now()
  const dbName = params.dbName.trim()
  const campaignId = params.campaignId?.trim() || null
  const client = params.archiveClient ?? { list: listZcMailArchive, getById: getZcMailArchiveById }

  const t0 = Date.now()
  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  let campaignMessageIds = new Set<string>()
  let routing = new Map<string, { dbName: string; campaignId: string; userEmail: string }>()
  let usedTenantListFallback = false
  let usedMessageIdBackfill = false
  let campaignOperatorUserEmail = ''

  const listBase = {
    client,
    baseUrl: params.config.zcMailBaseUrl,
    apiKey: params.config.apiKey,
    tenantName: params.config.zcMailTenant,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd,
    campaign: campaignId || undefined
  }

  let listed: ZcMailArchiveListItem[]
  try {
    if (campaignId) {
      // Mongo first (fast) so campaign archive probe can abort when filters return
      // the wrong campaign's rows.
      campaignMessageIds = await loadCampaignRecipientMatchIndex(dbName, campaignId).catch(
        (err) => {
          console.warn('[zcMail tracking] campaign recipient index failed', {
            campaignId,
            error: err instanceof Error ? err.message : String(err)
          })
          return new Set<string>()
        }
      )

      const uniqueRecipientIds = uniqueStrippedMessageIds(campaignMessageIds)

      // Small/medium campaigns: parallel `q` by SES id (capped). Faster than probing a
      // flaky campaign/tag filter that often pages thousands of unrelated rows.
      if (
        uniqueRecipientIds.length > 0 &&
        uniqueRecipientIds.length <= ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_MAX
      ) {
        listed = await loadArchivesByMessageIdQueries({
          client,
          baseUrl: params.config.zcMailBaseUrl,
          apiKey: params.config.apiKey,
          tenantName: params.config.zcMailTenant,
          fromYmd: params.fromYmd,
          toYmd: params.toYmd,
          messageIds: campaignMessageIds
        })
        usedMessageIdBackfill = true
        usedTenantListFallback = true
      } else {
        const archives = await loadCampaignArchivesFast({
          client,
          baseUrl: params.config.zcMailBaseUrl,
          apiKey: params.config.apiKey,
          tenantName: params.config.zcMailTenant,
          fromYmd: params.fromYmd,
          toYmd: params.toYmd,
          campaignId,
          matchMessageIds: campaignMessageIds.size > 0 ? campaignMessageIds : undefined
        })
        usedTenantListFallback = archives.usedTenantListFallback

        const matchedItems = archives.items.filter((item) =>
          archiveItemMatchesMessageIds(item, campaignMessageIds)
        )

        if (campaignMessageIds.size > 0 && matchedItems.length === 0) {
          console.warn(
            '[zcMail tracking] campaign archive list missed recipient message ids; scanning tenant list',
            {
              campaignId,
              listed: archives.items.length,
              campaignRecipientMessageIds: campaignMessageIds.size
            }
          )
          // Large campaigns: page the tenant list in parallel and keep matches —
          // never unbounded per-id `q` (that is what caused 15+ minute Refreshes).
          listed = await loadArchivesInRange({
            client,
            baseUrl: params.config.zcMailBaseUrl,
            apiKey: params.config.apiKey,
            tenantName: params.config.zcMailTenant,
            fromYmd: params.fromYmd,
            toYmd: params.toYmd,
            matchMessageIds: campaignMessageIds,
            keepMatchedOnly: true,
            maxPages: ZC_MAIL_ARCHIVE_STATS_MAX_PAGES
          })
          usedMessageIdBackfill = true
          usedTenantListFallback = true
        } else if (campaignMessageIds.size > 0 && matchedItems.length < archives.items.length) {
          listed = matchedItems
        } else {
          listed = archives.items
        }
      }
    } else {
      // Analytics “All campaigns”: list-only snapshot, hard page cap. Opens/clicks
      // come from webhooks; do not detail-GET thousands of archive rows.
      listed = await loadArchivesInRange({
        ...listBase,
        maxPages: ZC_MAIL_ARCHIVE_TENANT_WIDE_MAX_PAGES
      })
    }
  } catch (error) {
    const message =
      error instanceof ZcMailSendError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)
    return {
      fetched: 0,
      upserted: 0,
      modified: 0,
      timingsMs: { brevoFetch: Date.now() - t0, total: Date.now() - started },
      error: message,
      debug: {
        campaignId,
        fromYmd: params.fromYmd?.trim() || null,
        toYmd: params.toYmd?.trim() || null,
        zcMailTenant: params.config.zcMailTenant,
        usedTenantListFallback,
        usedMessageIdBackfill,
        campaignRecipientMessageIds: campaignMessageIds.size,
        listed: 0,
        matched: 0,
        scoped: 0,
        routingHits: 0,
        sampleRecipientMessageIds: [...campaignMessageIds].slice(0, 5),
        sampleListed: []
      }
    }
  }

  const scope = (item: ZcMailArchiveListItem) => {
    const hit = routingHitForItem(item, routing)
    return zcMailArchiveBelongsToScope(item, {
      dbName,
      campaignId,
      routedCampaignId: hit?.campaignId || null,
      routedDbName: hit?.dbName || null,
      campaignMessageIds
    })
  }

  const lookupIds = listed.flatMap((item) => zcMailArchiveLookupIds(item))
  try {
    routing = await findEmailMessageRoutingMap(lookupIds)
  } catch (err) {
    console.warn('[zcMail tracking] routing lookup failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  }

  if (campaignId) {
    campaignOperatorUserEmail = await loadCampaignOperatorUserEmail(dbName, campaignId)
  }

  const matched = listed.filter((item) => scope(item))
  // Tenant-wide Refresh may enrich untagged rows. Campaign Refresh must not
  // pull the rest of the mailbox just because the recipient address matches.
  const needsTags = campaignId
    ? []
    : listed.filter((item) => {
        const tags = item.tags || {}
        return !tags.campaign && !routingHitForItem(item, routing)
      })

  const candidates = uniqueArchiveItems([...matched, ...needsTags])
  const candidateLookupIds = candidates.flatMap((item) => zcMailArchiveLookupIds(item))
  let alreadyEnriched = new Set<string>()
  try {
    alreadyEnriched = await loadAlreadyEnrichedMessageIds(BrevoTrackingEvent, candidateLookupIds)
  } catch (err) {
    console.warn('[zcMail tracking] enriched-id lookup failed', {
      error: err instanceof Error ? err.message : String(err)
    })
  }

  const needsDetail: ZcMailArchiveListItem[] = []
  const listOnly: ZcMailArchiveListItem[] = []
  // Tenant-wide Refresh: list status only. Detail GETs for opens/clicks are for
  // campaign-scoped Refresh (and webhooks already cover live engagement).
  const allowDetailFetches = Boolean(campaignId)
  for (const item of candidates) {
    const ids = zcMailArchiveLookupIds(item)
    const enriched = ids.some((id) => alreadyEnriched.has(id))
    if (!allowDetailFetches || enriched) {
      listOnly.push(item)
      continue
    }
    if (needsDetail.length < ZC_MAIL_ARCHIVE_DETAIL_MAX) {
      needsDetail.push(item)
    } else {
      listOnly.push(item)
    }
  }

  const details = await mapPool(needsDetail, ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY, async (item) => {
    try {
      return await client.getById({
        baseUrl: params.config.zcMailBaseUrl,
        apiKey: params.config.apiKey,
        archiveId: item.id
      })
    } catch {
      return item
    }
  })

  const detailById = new Map<string, ZcMailArchiveListItem | ZcMailArchiveDetail>()
  for (const item of details) {
    detailById.set(item.id, item)
  }

  // Prefer detail (SES events) when fetched; otherwise upsert list-row status so
  // large campaigns still get delivered/bounce without waiting on N detail GETs.
  const toMap: Array<ZcMailArchiveListItem | ZcMailArchiveDetail> = []
  const seenMapIds = new Set<string>()
  for (const item of candidates) {
    if (seenMapIds.has(item.id)) continue
    seenMapIds.add(item.id)
    toMap.push(detailById.get(item.id) || item)
  }

  const scoped = toMap.filter((item) => scope(item))

  const events = scoped.flatMap((item) => {
    const hit = routingHitForItem(item, routing)
    const scopedItem = withScopedZcMailArchiveTags(item, {
      dbName,
      campaignId: campaignId || hit?.campaignId || null,
      userEmail: hit?.userEmail || campaignOperatorUserEmail || null
    })
    if ('events' in item && Array.isArray((item as ZcMailArchiveDetail).events)) {
      return mapZcMailArchiveItemToTrackingEvents({
        ...scopedItem,
        events: (item as ZcMailArchiveDetail).events
      })
    }
    return mapZcMailArchiveItemToTrackingEvents(scopedItem)
  })

  const usable = events.filter(
    (ev) => (ev.messageId || '').trim() && (ev.event || '').trim() && (ev.date || '').trim()
  )
  const archiveFetchMs = Date.now() - t0

  await ensureBrevoTrackingIndexes(BrevoTrackingEvent)

  let upserted = 0
  let modified = 0
  const t1 = Date.now()
  for (let i = 0; i < usable.length; i += BULK_CHUNK) {
    const slice = usable.slice(i, i + BULK_CHUNK)
    const ops: AnyBulkWriteOperation[] = slice.map((ev) => {
      const doc = brevoEventToTrackingDoc(ev)
      const filter =
        doc.eventKeyAt != null
          ? { messageId: doc.messageId, event: doc.event, eventKeyAt: doc.eventKeyAt }
          : { messageId: doc.messageId, event: doc.event, date: doc.date }
      return {
        updateOne: {
          filter,
          update: { $set: doc },
          upsert: true
        }
      }
    })
    const result = await BrevoTrackingEvent.bulkWrite(ops, { ordered: false })
    upserted += result.upsertedCount ?? 0
    modified += result.modifiedCount ?? 0
  }

  if (campaignId) {
    await BrevoTrackingEvent.updateMany(
      { campaignId, tag: CAMPAIGN_TEST_EMAIL_TAG_RE },
      { $set: { campaignId: '' } }
    )
    const keepIds = new Set<string>(campaignMessageIds)
    for (const item of scoped) {
      for (const id of zcMailArchiveLookupIds(item)) keepIds.add(id)
    }
    for (const ev of usable) {
      const id = String(ev.messageId || '').trim()
      if (id) keepIds.add(id)
    }
    if (keepIds.size > 0) {
      const variants = [...new Set(
        [...keepIds].flatMap((id) => {
          const stripped = id.replace(/^<|>$/g, '')
          return stripped ? [id, stripped, `<${stripped}>`] : [id]
        })
      )]
      await BrevoTrackingEvent.updateMany(
        { campaignId, messageId: { $nin: variants } },
        { $set: { campaignId: '' } }
      )
    }
  }
  const upsertMs = Date.now() - t1

  const t2 = Date.now()
  // Skip expensive dedupe when this Refresh wrote nothing new.
  const dedupe =
    upserted + modified > 0
      ? await dedupeBrevoTrackingEvents(BrevoTrackingEvent, { campaignId })
      : { removed: 0 }
  const dedupeMs = Date.now() - t2
  const total = Date.now() - started

  console.info('[tracking.sync.zcmail]', {
    campaignId,
    listed: listed.length,
    scoped: scoped.length,
    detailFetches: needsDetail.length,
    listOnly: listOnly.length,
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    usedTenantListFallback,
    usedMessageIdBackfill,
    campaignRecipientMessageIds: campaignMessageIds.size,
    timingsMs: { archiveFetch: archiveFetchMs, upsert: upsertMs, dedupe: dedupeMs, total }
  })

  const debug = {
    campaignId,
    fromYmd: params.fromYmd?.trim() || null,
    toYmd: params.toYmd?.trim() || null,
    zcMailTenant: params.config.zcMailTenant,
    usedTenantListFallback,
    usedMessageIdBackfill,
    campaignRecipientMessageIds: campaignMessageIds.size,
    listed: listed.length,
    matched: matched.length,
    scoped: scoped.length,
    routingHits: routing.size,
    sampleRecipientMessageIds: [...campaignMessageIds].slice(0, 5),
    sampleListed: listed.slice(0, 5).map((item) => {
      const ids = zcMailArchiveLookupIds(item)
      const hit = routingHitForItem(item, routing)
      return {
        id: item.id,
        messageId: item.messageId || '',
        sesMessageId: item.sesMessageId || '',
        recipient: item.recipient || item.to?.[0] || '',
        status: item.status || '',
        createdAt: item.createdAt || '',
        tags: item.tags || {},
        inRecipientIndex: ids.some(
          (id) =>
            campaignMessageIds.has(id) ||
            campaignMessageIds.has(id.replace(/^<|>$/g, ''))
        ),
        routingCampaignId: hit?.campaignId || null
      }
    })
  }

  return {
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    timingsMs: { brevoFetch: archiveFetchMs, upsert: upsertMs, dedupe: dedupeMs, total },
    debug
  }
}
