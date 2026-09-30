import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { aggregateStoredBrevoSmtpStats } from '@server/utils/tracking/aggregateStoredBrevoSmtpStats'
import { marketingAnalyticsFromSmtpStats } from '@server/utils/tracking/marketingAnalyticsFromSmtpStats'
import type { MarketingAnalyticsSummary, MarketingAnalyticsTimeseriesPoint } from '@server/utils/tracking/computeMarketingAnalytics'
import {
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays
} from '@server/utils/tracking/fetchBrevoTransactionalStats'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { rollupAdminAnalytics } from '@server/utils/admin/adminAnalyticsRollup'

export type AdminAnalyticsTenantRow = {
  tenantDbName: string
  tenantName: string
  summary: MarketingAnalyticsSummary
}

function assertYmd(value: string, label: string): string {
  const ymd = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw createError({ statusCode: 400, message: `${label} must be YYYY-MM-DD` })
  }
  return ymd
}

/** Opens, clicks, and delivery across tenants from stored tracking events. */
export async function listAdminAnalytics(options: {
  from: string
  to: string
  tzOffsetMinutes?: number | null
  tenantDbName?: string
}): Promise<{
  from: string
  to: string
  summary: MarketingAnalyticsSummary
  timeseries: MarketingAnalyticsTimeseriesPoint[]
  tenants: AdminAnalyticsTenantRow[]
}> {
  const ranged = clampBrevoSmtpDateRange(
    assertYmd(options.from, 'from'),
    assertYmd(options.to, 'to'),
    new Date(),
    options.tzOffsetMinutes
  )
  const clamped = clampBrevoSmtpStatsRangeToMaxDays(ranged.startDate, ranged.endDate)

  const tenantFilter = String(options.tenantDbName ?? '').trim()
  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]
  const tenants = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .filter((t) => !tenantFilter || t.dbName === tenantFilter)
    .sort((a, b) => a.name.localeCompare(b.name))

  const collected: Array<{
    tenantDbName: string
    tenantName: string
    aggregated: Awaited<ReturnType<typeof aggregateStoredBrevoSmtpStats>>['aggregated']
    daily: Awaited<ReturnType<typeof aggregateStoredBrevoSmtpStats>>['daily']
  }> = []

  for (const tenant of tenants) {
    try {
      await getTenantConnectionByDbName(tenant.dbName)
      const stats = await aggregateStoredBrevoSmtpStats({
        dbName: tenant.dbName,
        startDate: clamped.startDate,
        endDate: clamped.endDate,
        tzOffsetMinutes: options.tzOffsetMinutes
      })
      collected.push({
        tenantDbName: tenant.dbName,
        tenantName: tenant.name,
        aggregated: stats.aggregated,
        daily: stats.daily
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminAnalytics] skip tenant', { dbName: tenant.dbName, message })
    }
  }

  const rolled = rollupAdminAnalytics(collected)
  const tenantRows = collected
    .map((row) => ({
      tenantDbName: row.tenantDbName,
      tenantName: row.tenantName,
      summary: marketingAnalyticsFromSmtpStats(row.aggregated, row.daily).summary
    }))
    .filter((row) => tenantFilter || row.summary.emailsSent > 0)
    .sort((a, b) => b.summary.emailsSent - a.summary.emailsSent)

  return {
    from: clamped.startDate,
    to: clamped.endDate,
    summary: rolled.summary,
    timeseries: rolled.timeseries,
    tenants: tenantRows
  }
}
