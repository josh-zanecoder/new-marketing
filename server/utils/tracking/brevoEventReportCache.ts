/**
 * @deprecated Prefer {@link fetchTenantBrevoEmailEvents} — paginated + 90-day default.
 * Kept for any residual callers; single-page Brevo report only.
 */
import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import { resolveBrevoEventReportRequest } from './brevoEventReportQuery'

const CACHE_TTL_MS = 45_000

export interface BrevoEventReportDateParams {
  startDate?: string | null
  endDate?: string | null
  fromYmd?: string | null
  toYmd?: string | null
}

interface CacheEntry {
  expiresAt: number
  report: unknown
}

const reportCache = new Map<string, CacheEntry>()

function buildCacheKey(params: BrevoEventReportDateParams, dbName: string, keySeg: string): string {
  const from = (params.fromYmd ?? params.startDate)?.trim() ?? ''
  const to = (params.toYmd ?? params.endDate)?.trim() ?? ''
  return `${dbName}|${keySeg}|${from}|${to}`
}

function toBrevoRequestParams(params: BrevoEventReportDateParams): GetEmailEventReportRequest {
  const fromYmd = (params.fromYmd ?? params.startDate)?.trim() || null
  const toYmd = (params.toYmd ?? params.endDate)?.trim() || null
  return resolveBrevoEventReportRequest(fromYmd, toYmd)
}

export async function fetchCachedBrevoEventReport(
  params: BrevoEventReportDateParams = {},
  options?: { dbName?: string | null; apiKey?: string }
): Promise<{ report?: unknown; error?: string }> {
  const dbSeg = options?.dbName?.trim() || ''
  const keySeg = options?.apiKey?.trim() ? 'explicit' : 'resolved'
  const key = buildCacheKey(params, dbSeg, keySeg)
  const cached = reportCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return { report: cached.report }
  }

  const result = await getTransactionalEmailEventReport(toBrevoRequestParams(params), {
    dbName: options?.dbName,
    apiKey: options?.apiKey
  })
  if (!result.error && result.report !== undefined) {
    reportCache.set(key, {
      report: result.report,
      expiresAt: Date.now() + CACHE_TTL_MS
    })
  }

  return result
}

export function clearBrevoEventReportCacheForTests(): void {
  reportCache.clear()
}
