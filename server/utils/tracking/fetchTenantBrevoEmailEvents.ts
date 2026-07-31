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
 * Brevo Logs UI ↔ API `event` values (export/webhook docs).
 * @see https://developers.brevo.com/docs/bulk-fetch-all-your-transactional-activity
 * @see https://developers.brevo.com/reference/get-email-event-report
 *
 * Logs label          → API event
 * Sent                → requests
 * Delivered           → delivered
 * First opening       → unique_opened
 * Opened              → opened
 * Loaded by proxy     → loadedByProxy
 * Clicked             → clicks
 * Soft bounce         → softBounces
 * Hard bounce         → hardBounces
 * Error               → error
 * Blocked             → blocked
 * Deferred            → deferred
 * Invalid Email       → invalid
 * Complaint           → spam
 * Unsubscribed        → unsubscribed
 */
const BREVO_SCOPED_EVENT_TYPES = [
  'requests',
  'delivered',
  'unique_opened',
  'opened',
  'clicks',
  'softBounces',
  'hardBounces',
  'deferred',
  'blocked',
  'spam',
  'invalid',
  'unsubscribed',
  'error',
  'loadedByProxy'
] as const

/** Cap how far we page; with tag + per-event scoping this is plenty for a campaign. */
const BREVO_MAX_PAGINATION_OFFSET = 100_000
const CACHE_TTL_MS = 45_000

export { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

export interface FetchBrevoEmailEventsParams {
  fromYmd?: string | null
  toYmd?: string | null
  dbName?: string | null
  apiKey?: string
  campaignId?: string | null
  /**
   * Override Brevo `tags` query (comma-separated per docs).
   * Empty string skips the Brevo tag filter.
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
  return `${dbSeg}|${keySeg}|${tagsSeg}|${JSON.stringify(dateQuery)}|v2-per-event`
}

function resolveTagsParam(params: FetchBrevoEmailEventsParams): string | undefined {
  if (params.tags === '') return undefined
  if (typeof params.tags === 'string' && params.tags.trim()) return params.tags.trim()
  return buildBrevoEventReportTagsFilter({
    dbName: params.dbName,
    campaignId: params.campaignId
  })
}

function eventDedupeKey(e: BrevoTrackingEmailEvent): string {
  const link =
    e && typeof e === 'object' && 'link' in e && typeof (e as { link?: unknown }).link === 'string'
      ? (e as { link: string }).link
      : ''
  return [e.messageId ?? '', e.event ?? '', e.date ?? '', e.email ?? '', link].join('|')
}

function mergeUnique(
  into: BrevoTrackingEmailEvent[],
  seen: Set<string>,
  batch: BrevoTrackingEmailEvent[]
): void {
  for (const ev of batch) {
    const key = eventDedupeKey(ev)
    if (seen.has(key)) continue
    seen.add(key)
    into.push(ev)
  }
}

async function fetchPages(
  dateQuery: ReturnType<typeof resolveBrevoEventReportRequest>,
  tags: string | undefined,
  options: {
    dbName?: string | null
    apiKey?: string
    /** Documented enum value, or `unique_opened` (Logs “First opening”). */
    event?: string
  }
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
      ...(tags ? { tags } : {}),
      ...(options.event
        ? { event: options.event as GetEmailEventReportRequest['event'] }
        : {})
    }
    const { report, error } = await getTransactionalEmailEventReport(request, {
      dbName: options.dbName,
      apiKey: options.apiKey
    })
    if (error) {
      // `unique_opened` is in export/webhook docs but may 400 on the events filter enum.
      if (options.event === 'unique_opened') {
        return { events: merged }
      }
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
 * Tag-scoped fetch: one paginated walk per Logs/API event so mixed streams cannot
 * truncate clicks/opens. Then one unfiltered pass to catch any leftover types.
 */
async function fetchScopedByEventTypes(
  dateQuery: ReturnType<typeof resolveBrevoEventReportRequest>,
  tags: string,
  options: { dbName?: string | null; apiKey?: string }
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const merged: BrevoTrackingEmailEvent[] = []
  const seen = new Set<string>()
  let lastError: string | undefined

  for (const event of BREVO_SCOPED_EVENT_TYPES) {
    const page = await fetchPages(dateQuery, tags, { ...options, event })
    if (page.error) lastError = page.error
    mergeUnique(merged, seen, page.events)
  }

  // Catch-all (no event filter) picks up any types not in the enum walk.
  const catchAll = await fetchPages(dateQuery, tags, options)
  if (catchAll.error) lastError = catchAll.error
  mergeUnique(merged, seen, catchAll.events)

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
  const clientOpts = { dbName: params.dbName, apiKey: params.apiKey }

  let result: { events: BrevoTrackingEmailEvent[]; error?: string }

  if (tags) {
    result = await fetchScopedByEventTypes(dateQuery, tags, clientOpts)
    if (!result.error && result.events.length === 0) {
      result = await fetchPages(dateQuery, undefined, clientOpts)
    }
  } else {
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
