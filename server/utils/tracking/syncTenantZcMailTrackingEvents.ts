import type { AnyBulkWriteOperation } from 'mongoose'
import {
  ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY,
  ZC_MAIL_ARCHIVE_DETAIL_MAX,
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
}): Promise<ZcMailArchiveListItem[]> {
  const collected: ZcMailArchiveListItem[] = []
  for (let page = 0; page < ZC_MAIL_ARCHIVE_STATS_MAX_PAGES; page += 1) {
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
  if (campaignId) {
    try {
      campaignMessageIds = await loadCampaignRecipientMatchIndex(dbName, campaignId)
    } catch (err) {
      console.warn('[zcMail tracking] campaign recipient index failed', {
        campaignId,
        error: err instanceof Error ? err.message : String(err)
      })
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

  let listed: ZcMailArchiveListItem[]
  try {
    const listBase = {
      client,
      baseUrl: params.config.zcMailBaseUrl,
      apiKey: params.config.apiKey,
      tenantName: params.config.zcMailTenant,
      fromYmd: params.fromYmd,
      toYmd: params.toYmd,
      campaign: campaignId || undefined
    }
    if (campaignId) {
      const collected: ZcMailArchiveListItem[] = []
      const searchTerms = [
        ...zcMailArchiveCampaignSearchTerms(campaignId),
        ...campaignMessageIds
      ]
      for (const q of [...new Set(searchTerms.map((term) => term.trim()).filter(Boolean))]) {
        const batch = await loadArchivesInRange({ ...listBase, q })
        collected.push(...batch)
      }
      listed = uniqueArchiveItems(collected)
      if (listed.length === 0) {
        listed = await loadArchivesInRange(listBase)
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
      error: message
    }
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
  const seenIds = new Set<string>()
  const forDetails: ZcMailArchiveListItem[] = []
  for (const item of [...matched, ...needsTags]) {
    if (seenIds.has(item.id)) continue
    seenIds.add(item.id)
    forDetails.push(item)
    if (forDetails.length >= ZC_MAIL_ARCHIVE_DETAIL_MAX) break
  }

  const details = await mapPool(forDetails, ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY, async (item) => {
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

  const scoped = details.filter((item) => scope(item))

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
  const dedupe = await dedupeBrevoTrackingEvents(BrevoTrackingEvent, {
    campaignId
  })
  const dedupeMs = Date.now() - t2
  const total = Date.now() - started

  console.info('[tracking.sync.zcmail]', {
    campaignId,
    listed: listed.length,
    scoped: scoped.length,
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    timingsMs: { archiveFetch: archiveFetchMs, upsert: upsertMs, dedupe: dedupeMs, total }
  })

  return {
    fetched: usable.length,
    upserted,
    modified,
    deduped: dedupe.removed,
    timingsMs: { brevoFetch: archiveFetchMs, upsert: upsertMs, dedupe: dedupeMs, total }
  }
}
