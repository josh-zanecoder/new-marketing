/**
 * @deprecated Prefer {@link fetchTenantBrevoEmailEvents} directly.
 * Delegates to the rate-safe paginated fetch (429/502 retries, cache, coalescing).
 */
import {
  clearBrevoEmailEventsCacheForTests,
  fetchTenantBrevoEmailEvents
} from './fetchTenantBrevoEmailEvents'

export interface BrevoEventReportDateParams {
  startDate?: string | null
  endDate?: string | null
  fromYmd?: string | null
  toYmd?: string | null
}

export async function fetchCachedBrevoEventReport(
  params: BrevoEventReportDateParams = {},
  options?: { dbName?: string | null; apiKey?: string }
): Promise<{ report?: unknown; error?: string }> {
  const fromYmd = (params.fromYmd ?? params.startDate)?.trim() || null
  const toYmd = (params.toYmd ?? params.endDate)?.trim() || null
  const { events, error } = await fetchTenantBrevoEmailEvents({
    fromYmd,
    toYmd,
    dbName: options?.dbName,
    apiKey: options?.apiKey,
    tags: ''
  })
  if (error) return { error }
  return { report: { events } }
}

export function clearBrevoEventReportCacheForTests(): void {
  clearBrevoEmailEventsCacheForTests()
}
