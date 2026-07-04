import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'

const CACHE_TTL_MS = 45_000

export interface BrevoEventReportDateParams {
  startDate?: string | null
  endDate?: string | null
}

interface CacheEntry {
  expiresAt: number
  report: unknown
}

const reportCache = new Map<string, CacheEntry>()

function buildCacheKey(params: BrevoEventReportDateParams): string {
  const start = params.startDate?.trim() ?? ''
  const end = params.endDate?.trim() ?? ''
  return `${start}|${end}`
}

function toBrevoRequestParams(params: BrevoEventReportDateParams): GetEmailEventReportRequest {
  const startDate = params.startDate?.trim()
  const endDate = params.endDate?.trim()
  if (startDate && endDate) {
    return { startDate, endDate }
  }
  return {}
}

export async function fetchCachedBrevoEventReport(
  params: BrevoEventReportDateParams = {}
): Promise<{ report?: unknown; error?: string }> {
  const key = buildCacheKey(params)
  const cached = reportCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return { report: cached.report }
  }

  const result = await getTransactionalEmailEventReport(toBrevoRequestParams(params))
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
