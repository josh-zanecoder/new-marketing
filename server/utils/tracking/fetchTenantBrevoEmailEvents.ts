import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import { resolveBrevoEventReportRequest } from './brevoEventReportQuery'
import {
  extractBrevoEventsFromReport,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'

const BREVO_EVENTS_PAGE_LIMIT = 2500
const BREVO_MAX_PAGINATION_OFFSET = 20_000
const CACHE_TTL_MS = 45_000

export { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

export interface FetchBrevoEmailEventsParams {
  fromYmd?: string | null
  toYmd?: string | null
  /** When set, resolve the per-tenant Brevo API key. Tenant scoping is done in-app. */
  dbName?: string | null
  apiKey?: string
  /**
   * Optional Brevo `tags` query. Prefer omitting this — Brevo’s tag filter format is
   * unreliable for multi-tag sends; we filter by `db:` / `tenant:` / `user:` / `campaign:` in-app.
   */
  tags?: string | null
}

interface CacheEntry {
  expiresAt: number
  events: BrevoTrackingEmailEvent[]
}

const eventsCache = new Map<string, CacheEntry>()

function buildCacheKey(params: FetchBrevoEmailEventsParams): string {
  const dateQuery = resolveBrevoEventReportRequest(params.fromYmd ?? null, params.toYmd ?? null)
  const dbSeg = params.dbName?.trim() || ''
  const keySeg = params.apiKey?.trim() ? 'explicit' : 'resolved'
  const tagsSeg = params.tags?.trim() ? params.tags.trim() : 'notags'
  return `${dbSeg}|${keySeg}|${tagsSeg}|${JSON.stringify(dateQuery)}`
}

function resolveTagsParam(params: FetchBrevoEmailEventsParams): string | undefined {
  const tags = params.tags?.trim()
  return tags || undefined
}

export async function fetchTenantBrevoEmailEvents(
  params: FetchBrevoEmailEventsParams = {}
): Promise<{ events: BrevoTrackingEmailEvent[]; error?: string }> {
  const cacheKey = buildCacheKey(params)
  const cached = eventsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { events: cached.events }
  }

  const dateQuery = resolveBrevoEventReportRequest(params.fromYmd ?? null, params.toYmd ?? null)
  const tags = resolveTagsParam(params)
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
      dbName: params.dbName,
      apiKey: params.apiKey
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

  eventsCache.set(cacheKey, {
    events: merged,
    expiresAt: Date.now() + CACHE_TTL_MS
  })

  return { events: merged, ...(lastError ? { error: lastError } : {}) }
}

export function clearBrevoEmailEventsCacheForTests(): void {
  eventsCache.clear()
}
