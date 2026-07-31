import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import {
  buildBrevoEventReportTagsFilter,
  resolveBrevoEventReportRequest
} from './brevoEventReportQuery'
import {
  extractBrevoEventsFromReport,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'

const BREVO_EVENTS_PAGE_LIMIT = 2500
/** With a Brevo tag filter, campaign/tenant volume fits; without tags this caps account-wide noise. */
const BREVO_MAX_PAGINATION_OFFSET = 50_000
const CACHE_TTL_MS = 45_000

export { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

export interface FetchBrevoEmailEventsParams {
  fromYmd?: string | null
  toYmd?: string | null
  /** Resolve the per-tenant Brevo API key and default `db:` tag filter. */
  dbName?: string | null
  apiKey?: string
  /** When set, Brevo-filter by `campaign:{id}` (preferred over `db:`). */
  campaignId?: string | null
  /**
   * Override Brevo `tags` query. `null`/omit = auto from campaignId/dbName.
   * Empty string skips the Brevo tag filter (account-wide fetch).
   */
  tags?: string | null
}

interface CacheEntry {
  expiresAt: number
  events: BrevoTrackingEmailEvent[]
}

const eventsCache = new Map<string, CacheEntry>()

function buildCacheKey(params: FetchBrevoEmailEventsParams, tags: string | undefined): string {
  const dateQuery = resolveBrevoEventReportRequest(params.fromYmd ?? null, params.toYmd ?? null)
  const dbSeg = params.dbName?.trim() || ''
  const keySeg = params.apiKey?.trim() ? 'explicit' : 'resolved'
  const tagsSeg = tags?.trim() || 'notags'
  return `${dbSeg}|${keySeg}|${tagsSeg}|${JSON.stringify(dateQuery)}`
}

function resolveTagsParam(params: FetchBrevoEmailEventsParams): string | undefined {
  if (params.tags === '') return undefined
  if (typeof params.tags === 'string' && params.tags.trim()) return params.tags.trim()
  return buildBrevoEventReportTagsFilter({
    dbName: params.dbName,
    campaignId: params.campaignId
  })
}

async function fetchPages(
  dateQuery: ReturnType<typeof resolveBrevoEventReportRequest>,
  tags: string | undefined,
  options: { dbName?: string | null; apiKey?: string }
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const merged: BrevoTrackingEmailEvent[] = []
  let offset = 0
  let lastError: string | undefined

  while (offset <= BREVO_MAX_PAGINATION_OFFSET) {
    const request: GetEmailEventReportRequest = {
      ...dateQuery,
      limit: BREVO_EVENTS_PAGE_LIMIT,
      offset,
      sort: 'desc',
      ...(tags ? { tags } : {})
    }
    const { report, error } = await getTransactionalEmailEventReport(request, {
      dbName: options.dbName,
      apiKey: options.apiKey
    })
    if (error) {
      lastError = error
      break
    }

    const batch = extractBrevoEventsFromReport(report)
    if (batch.length === 0) break
    merged.push(...batch)
    if (batch.length < BREVO_EVENTS_PAGE_LIMIT) break
    offset += BREVO_EVENTS_PAGE_LIMIT
  }

  if (lastError && merged.length === 0) {
    return { events: [], error: lastError }
  }
  return { events: merged, ...(lastError ? { error: lastError } : {}) }
}

export async function fetchTenantBrevoEmailEvents(
  params: FetchBrevoEmailEventsParams = {}
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const tags = resolveTagsParam(params)
  const cacheKey = buildCacheKey(params, tags)
  const cached = eventsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { events: cached.events }
  }

  const dateQuery = resolveBrevoEventReportRequest(params.fromYmd ?? null, params.toYmd ?? null)
  let result = await fetchPages(dateQuery, tags, {
    dbName: params.dbName,
    apiKey: params.apiKey
  })

  // If a Brevo tag filter yields nothing (format quirks / delay), fall back once without tags
  // so Tracking is not blank — in-app filters still apply.
  if (tags && !result.error && result.events.length === 0) {
    result = await fetchPages(dateQuery, undefined, {
      dbName: params.dbName,
      apiKey: params.apiKey
    })
  }

  if (!result.error) {
    eventsCache.set(cacheKey, {
      events: result.events,
      expiresAt: Date.now() + CACHE_TTL_MS
    })
  }

  return result
}

export function clearBrevoEmailEventsCacheForTests(): void {
  eventsCache.clear()
}
