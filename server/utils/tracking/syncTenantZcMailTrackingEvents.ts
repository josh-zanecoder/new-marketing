import type { AnyBulkWriteOperation } from 'mongoose'
import {
  ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY,
  ZC_MAIL_ARCHIVE_DETAIL_MAX,
  ZC_MAIL_ARCHIVE_MESSAGE_ID_BACKFILL_MAX_PAGES,
  ZC_MAIL_ARCHIVE_STATS_MAX_PAGES,
  ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT
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
}): Promise<ZcMailArchiveListItem[]> {
  const collected: ZcMailArchiveListItem[] = []
  const maxPages = params.maxPages ?? ZC_MAIL_ARCHIVE_STATS_MAX_PAGES
  for (let page = 0; page < maxPages; page += 1) {
    const skip = page * ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT
    const batch = await params.client.list({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      tenantName: params.tenantName,
      limit: ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT,
      skip,
      q: params.q,
      campaign: params.campaign
    })
    if (batch.items.length === 0) break

    let reachedBeforeRange = false
    for (const item of batch.items) {
      if (!zcMailArchiveInDateRange(item.createdAt, params.fromYmd, params.toYmd)) {
        const day = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ''
        if (params.fromYmd && day && day < params.fromYmd) reachedBeforeRange = true
        continue
      }
      collected.push(item)
    }

    if (batch.items.length < ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT) break
    if (reachedBeforeRange) {
      const oldest = batch.items[batch.items.length - 1]?.createdAt || ''
      const oldestDay = oldest ? new Date(oldest).toISOString().slice(0, 10) : ''
      if (params.fromYmd && oldestDay && oldestDay < params.fromYmd) break
    }
  }
  return collected
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

function countUniqueStrippedMessageIds(messageIds: Set<string>): number {
  const unique = new Set<string>()
  for (const id of messageIds) {
    const stripped = id.replace(/^<|>$/g, '').trim()
    if (stripped) unique.add(stripped)
  }
  return unique.size
}

/**
 * Newest-first tenant archive scan; keep rows whose SES/message ids are in the
 * campaign recipient index. Used when zcMail campaign/tag filters return the
 * wrong (or empty) set.
 */
async function loadArchivesMatchingMessageIds(params: {
  client: ZcMailArchiveTrackingClient
  baseUrl: string
  apiKey: string
  tenantName: string
  fromYmd?: string | null
  toYmd?: string | null
  messageIds: Set<string>
}): Promise<ZcMailArchiveListItem[]> {
  if (!params.messageIds.size) return []
  const targetUnique = countUniqueStrippedMessageIds(params.messageIds)
  const collected: ZcMailArchiveListItem[] = []
  const foundUnique = new Set<string>()

  for (let page = 0; page < ZC_MAIL_ARCHIVE_MESSAGE_ID_BACKFILL_MAX_PAGES; page += 1) {
    const skip = page * ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT
    const batch = await params.client.list({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      tenantName: params.tenantName,
      limit: ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT,
      skip
    })
    if (batch.items.length === 0) break

    let reachedBeforeRange = false
    for (const item of batch.items) {
      if (!zcMailArchiveInDateRange(item.createdAt, params.fromYmd, params.toYmd)) {
        const day = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ''
        if (params.fromYmd && day && day < params.fromYmd) reachedBeforeRange = true
        continue
      }
      if (!archiveItemMatchesMessageIds(item, params.messageIds)) continue
      collected.push(item)
      for (const id of zcMailArchiveLookupIds(item)) {
        const stripped = id.replace(/^<|>$/g, '').trim()
        if (
          stripped &&
          (params.messageIds.has(id) || params.messageIds.has(stripped))
        ) {
          foundUnique.add(stripped)
        }
      }
    }

    if (foundUnique.size >= targetUnique && targetUnique > 0) break
    if (batch.items.length < ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT) break
    if (reachedBeforeRange) {
      const oldest = batch.items[batch.items.length - 1]?.createdAt || ''
      const oldestDay = oldest ? new Date(oldest).toISOString().slice(0, 10) : ''
      if (params.fromYmd && oldestDay && oldestDay < params.fromYmd) break
    }
  }
  return uniqueArchiveItems(collected)
}

function routingHitForItem(
  item: ZcMailArchiveListItem,
  routing: Map<string, { dbName: string; campaignId: string }>
): { dbName: string; campaignId: string } | null {
  for (const id of zcMailArchiveLookupIds(item)) {
    const hit = routing.get(id)
    if (hit) return hit
  }
  return null
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
}): Promise<{ items: ZcMailArchiveListItem[]; usedTenantListFallback: boolean }> {
  const listBase = {
    client: params.client,
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    tenantName: params.tenantName,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd,
    campaign: params.campaignId
  }
  // Campaign + tag query params already scope the list. Also run a couple of `q`
  // searches in parallel for older archive rows — never one HTTP call per recipient.
  const searchTerms = zcMailArchiveCampaignSearchTerms(params.campaignId)
  const batches = await Promise.all([
    loadArchivesInRange(listBase),
    ...searchTerms.map((q) => loadArchivesInRange({ ...listBase, q }))
  ])
  const tagged = uniqueArchiveItems(batches.flat())
  if (tagged.length > 0) return { items: tagged, usedTenantListFallback: false }

  // zcMail archive UI can show the sends while campaign/tag filters return empty
  // (tags not indexed on list, or not persisted). Fall back to tenant-wide list in
  // range; caller scopes locally via recipient message ids / routing / tags.
  console.warn('[zcMail tracking] campaign archive filter empty; falling back to tenant list', {
    campaignId: params.campaignId,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd
  })
  const items = await loadArchivesInRange({
    client: params.client,
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    tenantName: params.tenantName,
    fromYmd: params.fromYmd,
    toYmd: params.toYmd
  })
  return { items, usedTenantListFallback: true }
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
  let routing = new Map<string, { dbName: string; campaignId: string }>()
  let usedTenantListFallback = false
  let usedMessageIdBackfill = false

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
      // Recipient message ids first — needed to detect bad campaign/tag filter results.
      campaignMessageIds = await loadCampaignRecipientMatchIndex(dbName, campaignId).catch(
        (err) => {
          console.warn('[zcMail tracking] campaign recipient index failed', {
            campaignId,
            error: err instanceof Error ? err.message : String(err)
          })
          return new Set<string>()
        }
      )

      const archives = await loadCampaignArchivesFast({
        client,
        baseUrl: params.config.zcMailBaseUrl,
        apiKey: params.config.apiKey,
        tenantName: params.config.zcMailTenant,
        fromYmd: params.fromYmd,
        toYmd: params.toYmd,
        campaignId
      })
      listed = archives.items
      usedTenantListFallback = archives.usedTenantListFallback

      const matchedByMessageId = listed.filter((item) =>
        archiveItemMatchesMessageIds(item, campaignMessageIds)
      ).length

      // zcMail campaign/tag filters sometimes return other campaigns' rows (empty tags).
      // Scan tenant archive by recipient SES ids instead.
      if (campaignMessageIds.size > 0 && matchedByMessageId === 0) {
        console.warn(
          '[zcMail tracking] campaign archive list missed recipient message ids; backfilling',
          {
            campaignId,
            listed: listed.length,
            campaignRecipientMessageIds: campaignMessageIds.size
          }
        )
        listed = await loadArchivesMatchingMessageIds({
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
      }
    } else {
      listed = await loadArchivesInRange(listBase)
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
  for (const item of candidates) {
    const ids = zcMailArchiveLookupIds(item)
    const enriched = ids.some((id) => alreadyEnriched.has(id))
    if (enriched) {
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
      campaignId: campaignId || hit?.campaignId || null
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
