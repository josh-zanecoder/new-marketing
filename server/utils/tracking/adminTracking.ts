import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import {
  eventMatchesAnyAdminTenant,
  extractBrevoEventsFromReport,
  filterBrevoEventsForTenant,
  normalizeCampaignIdQuery,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'

export type AdminTrackingTenant = {
  dbName: string
  marketingTenantId: string | null
}

export function assertAdminTrackingAuth(event: H3Event): void {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object' || !isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
}

export function normalizeAdminTenantDbQuery(event: H3Event): string | undefined {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.tenantDbName
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  return s || undefined
}

export async function listAdminTrackingTenants(
  tenantDbName?: string
): Promise<AdminTrackingTenant[]> {
  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]

  const tenants: AdminTrackingTenant[] = []
  for (const doc of rawDocs) {
    const row = toTenantAdminRow(doc as RegistryTenantDoc)
    if (!row?.dbName) continue
    if (tenantDbName && row.dbName !== tenantDbName) continue
    const marketingTenantId =
      typeof row.tenantId === 'string' && row.tenantId.trim() ? row.tenantId.trim() : null
    tenants.push({ dbName: row.dbName, marketingTenantId })
  }
  return tenants
}

export function filterBrevoEventsForAdminTenants(
  events: BrevoTrackingEmailEvent[],
  tenants: AdminTrackingTenant[],
  campaignId: string | null
): BrevoTrackingEmailEvent[] {
  if (!tenants.length) return []

  if (tenants.length === 1) {
    const tenant = tenants[0]!
    return filterBrevoEventsForTenant(events, tenant.dbName, tenant.marketingTenantId, campaignId)
  }

  return events.filter((item) => {
    if (campaignId) {
      const parts = item.tag?.split(',').map((p) => p.trim()) ?? []
      if (!parts.includes(`campaign:${campaignId}`)) return false
    }
    return eventMatchesAnyAdminTenant(item.tag, tenants)
  })
}

export async function fetchAdminTrackingReport(event: H3Event): Promise<{
  report: Record<string, unknown> & { events: BrevoTrackingEmailEvent[] }
}> {
  const tenantDbName = normalizeAdminTenantDbQuery(event)
  const tenants = await listAdminTrackingTenants(tenantDbName)
  if (tenantDbName && !tenants.length) {
    throw createError({ statusCode: 403, message: 'Unknown tenant for admin tracking' })
  }

  const { report, error } = await getTransactionalEmailEventReport({})
  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  const campaignId = normalizeCampaignIdQuery(event)
  const events = filterBrevoEventsForAdminTenants(
    extractBrevoEventsFromReport(report),
    tenants,
    campaignId
  )

  return {
    report: {
      ...(report != null && typeof report === 'object' ? report : {}),
      events
    }
  }
}
