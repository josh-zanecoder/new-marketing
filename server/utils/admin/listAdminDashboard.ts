import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { ADMIN_CAMPAIGN_ACTIVE_STATUSES } from '@server/utils/admin/adminCampaigns'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

export type AdminDashboardCampaignRow = {
  tenantDbName: string
  tenantName: string
  id: string
  name: string
  status: string
  updatedAt: string
  scheduledAt?: string
}

const LIST_LIMIT = 8

type CampaignLean = {
  _id: unknown
  name?: string
  status?: string
  updatedAt?: Date
  scheduledAt?: Date
}

function toRow(
  doc: CampaignLean,
  tenant: { dbName: string; name: string },
  fallbackStatus: string
): AdminDashboardCampaignRow {
  return {
    tenantDbName: tenant.dbName,
    tenantName: tenant.name,
    id: String(doc._id),
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Untitled',
    status: String(doc.status ?? fallbackStatus),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
    scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString() : undefined
  }
}

export async function listAdminDashboard(): Promise<{
  totalTenants: number
  activeCampaigns: number
  emailsSent: number
  sending: AdminDashboardCampaignRow[]
  scheduled: AdminDashboardCampaignRow[]
  failed: AdminDashboardCampaignRow[]
}> {
  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]
  const tenants = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((t): t is NonNullable<typeof t> => !!t)

  let activeCampaigns = 0
  let emailsSent = 0
  const sending: AdminDashboardCampaignRow[] = []
  const scheduled: AdminDashboardCampaignRow[] = []
  const failed: AdminDashboardCampaignRow[] = []

  for (const tenant of tenants) {
    try {
      const conn = await getTenantConnectionByDbName(tenant.dbName)
      const { Campaign, CampaignRecipient } = getTenantClientModels(conn)
      const [active, sent, sendingDocs, scheduledDocs, failedDocs] = await Promise.all([
        Campaign.countDocuments({ status: { $in: [...ADMIN_CAMPAIGN_ACTIVE_STATUSES] } }),
        CampaignRecipient.countDocuments({ status: 'sent' }),
        Campaign.find({ status: 'Sending' })
          .select('_id name status updatedAt scheduledAt')
          .sort({ updatedAt: -1 })
          .limit(LIST_LIMIT)
          .lean<CampaignLean[]>(),
        Campaign.find({ status: 'Scheduled' })
          .select('_id name status updatedAt scheduledAt')
          .sort({ scheduledAt: 1 })
          .limit(LIST_LIMIT)
          .lean<CampaignLean[]>(),
        Campaign.find({ status: 'Failed' })
          .select('_id name status updatedAt scheduledAt')
          .sort({ updatedAt: -1 })
          .limit(LIST_LIMIT)
          .lean<CampaignLean[]>()
      ])
      activeCampaigns += active
      emailsSent += sent
      const tenantRef = { dbName: tenant.dbName, name: tenant.name }
      for (const doc of sendingDocs) sending.push(toRow(doc, tenantRef, 'Sending'))
      for (const doc of scheduledDocs) scheduled.push(toRow(doc, tenantRef, 'Scheduled'))
      for (const doc of failedDocs) failed.push(toRow(doc, tenantRef, 'Failed'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminDashboard] skip tenant', { dbName: tenant.dbName, message })
    }
  }

  const byRecent = (a: AdminDashboardCampaignRow, b: AdminDashboardCampaignRow) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  const scheduleTime = (iso?: string) => {
    const t = iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
  }
  const bySchedule = (a: AdminDashboardCampaignRow, b: AdminDashboardCampaignRow) =>
    scheduleTime(a.scheduledAt) - scheduleTime(b.scheduledAt)

  return {
    totalTenants: tenants.length,
    activeCampaigns,
    emailsSent,
    sending: sending.sort(byRecent).slice(0, LIST_LIMIT),
    scheduled: scheduled.sort(bySchedule).slice(0, LIST_LIMIT),
    failed: failed.sort(byRecent).slice(0, LIST_LIMIT)
  }
}
