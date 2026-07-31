import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import {
  BREVO_EVENTS_PAGE_LIMIT,
  buildBrevoEventReportTagsFilter,
  resolveBrevoEventReportRequest
} from './brevoEventReportQuery'
import {
  extractBrevoEventsFromReport,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'

/**
 * Keep pagination modest: tagged + limit 5000 pages.
 * Do NOT fan out per event type / untagged backfills — that burns Brevo rate limits (429).
 * @see https://developers.brevo.com/docs/limit-headers
 * @see https://developers.brevo.com/reference/get-email-event-report
 */
const BREVO_MAX_PAGINATION_OFFSET = 50_000
/** Cache expensive event reports; Brevo docs recommend avoiding polling storms. */
const CACHE_TTL_MS = 5 * 60_000

export { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

export interface FetchBrevoEmailEventsParams {
  fromYmd?: string | null
  toYmd?: string | null
  dbName?: string | null
  apiKey?: string
  campaignId?: string | null
  /**
   * Override Brevo `tags` (comma-separated per docs).
   * Empty string = no tag filter.
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
  return `${dbSeg}|${keySeg}|${tagsSeg}|${JSON.stringify(dateQuery)}|v4-rate-safe`
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

/**
 * Fetch Brevo transactional events with minimal API calls:
 * one tagged (or untagged) paginated walk — then in-app tenant/user/campaign filters apply.
 */
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
  const clientOpts = { dbName: params.dbName, apiKey: params.apiKey }

  let result = await fetchPages(dateQuery, tags, clientOpts)

  // If the tag filter yields nothing (format/delay), one untagged fallback — still a single walk.
  if (tags && !result.error && result.events.length === 0) {
    result = await fetchPages(dateQuery, undefined, clientOpts)
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
