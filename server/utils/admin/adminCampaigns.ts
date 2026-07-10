import type { H3Event } from 'h3'
import type { Connection } from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import { getCampaignSendProgress } from '@server/services/send-campaign.service'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { listTenantCampaignsForIndex } from '@server/utils/admin/listTenantCampaignsForIndex'

export const ADMIN_CAMPAIGN_ACTIVE_STATUSES = [
  'Sending',
  'Paused',
  'Stopped',
  'Scheduled'
] as const

export const ADMIN_CAMPAIGN_HISTORY_STATUSES = ['Sent', 'Failed'] as const

export type AdminCampaignView = 'active' | 'history' | 'all'

export const ADMIN_CAMPAIGN_ALL_STATUSES = [
  'Draft',
  ...ADMIN_CAMPAIGN_ACTIVE_STATUSES,
  ...ADMIN_CAMPAIGN_HISTORY_STATUSES
] as const

export function assertAdminAuth(event: H3Event): void {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
}

export async function getAdminTenantConnection(dbNameRaw: string): Promise<Connection> {
  const dbName = String(dbNameRaw ?? '').trim()
  if (!dbName) {
    throw createError({ statusCode: 400, message: 'Tenant database name is required' })
  }
  return getTenantConnectionByDbName(dbName)
}

export type AdminCampaignRow = {
  tenantDbName: string
  tenantId: string | null
  tenantName: string
  campaignId: string
  campaignName: string
  status: string
  subject: string
  scheduledAt?: string
  createdAt: string
  updatedAt: string
  progress: {
    pending: number
    sent: number
    failed: number
    aborted: number
    total: number
    done: boolean
  } | null
}

export type AdminCampaignIndexItem = {
  tenantDbName: string
  tenantId: string | null
  tenantName: string
  id: string
  name: string
  sender: CampaignLean['sender']
  recipientsType: CampaignLean['recipientsType']
  recipientsListId?: string
  subject: string
  status: string
  scheduledAt?: string
  recipients: { email: string; contactId?: string }[]
  createdAt: string
  updatedAt: string
}

function statusesForView(view: AdminCampaignView): readonly string[] {
  if (view === 'all') return ADMIN_CAMPAIGN_ALL_STATUSES
  return view === 'active'
    ? ADMIN_CAMPAIGN_ACTIVE_STATUSES
    : ADMIN_CAMPAIGN_HISTORY_STATUSES
}

/** Cross-tenant campaign list mirroring tenant GET `/campaigns` (includes Draft). */
export async function listAdminCampaignsForIndex(options?: {
  tenantDbName?: string
  search?: string
  status?: string
}): Promise<{ campaigns: AdminCampaignIndexItem[] }> {
  const search = String(options?.search ?? '').trim().toLowerCase()
  const tenantFilter = String(options?.tenantDbName ?? '').trim()
  const statusFilter = String(options?.status ?? '').trim()

  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]

  const tenants = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .filter((t) => !tenantFilter || t.dbName === tenantFilter)

  const campaigns: AdminCampaignIndexItem[] = []

  for (const tenant of tenants) {
    let conn: Connection
    try {
      conn = await getTenantConnectionByDbName(tenant.dbName)
    } catch {
      continue
    }

    try {
      const rows = await listTenantCampaignsForIndex(conn)
      for (const c of rows) {
        if (statusFilter && statusFilter !== 'all' && c.status !== statusFilter) continue
        const name = typeof c.name === 'string' ? c.name : 'Untitled'
        if (
          search &&
          !name.toLowerCase().includes(search) &&
          !tenant.name.toLowerCase().includes(search)
        ) {
          continue
        }
        campaigns.push({
          tenantDbName: tenant.dbName,
          tenantId: tenant.tenantId,
          tenantName: tenant.name,
          ...c
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminCampaigns] list skip tenant', { dbName: tenant.dbName, message })
    }
  }

  campaigns.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt).getTime()
    const tb = new Date(b.updatedAt || b.createdAt).getTime()
    return tb - ta
  })

  return { campaigns }
}

/** Legacy send-focused list (active/history views with progress). */
export async function listAdminCampaignSends(options: {
  view?: AdminCampaignView
  tenantDbName?: string
  search?: string
}): Promise<{ items: AdminCampaignRow[] }> {
  const view = options.view ?? 'active'
  const statuses = statusesForView(view)
  const search = String(options.search ?? '').trim().toLowerCase()
  const tenantFilter = String(options.tenantDbName ?? '').trim()

  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]

  const tenants = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .filter((t) => !tenantFilter || t.dbName === tenantFilter)

  const items: AdminCampaignRow[] = []

  for (const tenant of tenants) {
    let conn: Connection
    try {
      conn = await getTenantConnectionByDbName(tenant.dbName)
    } catch {
      continue
    }

    const { Campaign } = getTenantClientModels(conn)
    const campaignDocs = await (Campaign as CampaignModel)
      .find({ status: { $in: [...statuses] } })
      .select('_id name status subject scheduledAt createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean<
        Array<
          Pick<
            CampaignLean,
            '_id' | 'name' | 'status' | 'subject' | 'scheduledAt' | 'createdAt' | 'updatedAt'
          >
        >
      >()

    for (const c of campaignDocs) {
      const campaignName = typeof c.name === 'string' ? c.name : 'Untitled'
      if (search && !campaignName.toLowerCase().includes(search)) continue

      const campaignId = String(c._id)
      let progress: AdminCampaignRow['progress'] = null

      const needsProgress =
        c.status === 'Sending' ||
        c.status === 'Paused' ||
        c.status === 'Stopped' ||
        c.status === 'Sent' ||
        c.status === 'Failed'

      if (needsProgress) {
        try {
          const models = getTenantClientModels(conn)
          const res = await getCampaignSendProgress(models, campaignId)
          progress = {
            pending: res.pending,
            sent: res.sent,
            failed: res.failed,
            aborted: res.aborted ?? 0,
            total: res.total,
            done: res.done
          }
        } catch {
          progress = null
        }
      }

      items.push({
        tenantDbName: tenant.dbName,
        tenantId: tenant.tenantId,
        tenantName: tenant.name,
        campaignId,
        campaignName,
        status: String(c.status),
        subject: typeof c.subject === 'string' ? c.subject : '',
        scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString() : undefined,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : '',
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
        progress
      })
    }
  }

  items.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt).getTime()
    const tb = new Date(b.updatedAt || b.createdAt).getTime()
    return tb - ta
  })

  return { items }
}

async function forEachRegistryTenant(
  tenantDbName: string | undefined,
  handler: (conn: Connection, row: { dbName: string }) => Promise<void>
): Promise<void> {
  const tenantFilter = String(tenantDbName ?? '').trim()
  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]

  for (const doc of rawDocs) {
    const row = toTenantAdminRow(doc as RegistryTenantDoc)
    if (!row?.dbName) continue
    if (tenantFilter && row.dbName !== tenantFilter) continue
    let conn: Connection
    try {
      conn = await getTenantConnectionByDbName(row.dbName)
    } catch {
      continue
    }
    try {
      await handler(conn, { dbName: row.dbName })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminCampaigns] tenant handler skip', { dbName: row.dbName, message })
    }
  }
}

export async function haltAllActiveCampaignSendsGlobal(options?: {
  tenantDbName?: string
}): Promise<{
  ok: true
  halted: Array<{
    tenantDbName: string
    campaignId: string
    status: string
    pending: number
    sent: number
    failed: number
  }>
}> {
  const { haltAllActiveCampaignSends } = await import(
    '@server/services/campaign-send-control.service'
  )

  const halted: Array<{
    tenantDbName: string
    campaignId: string
    status: string
    pending: number
    sent: number
    failed: number
  }> = []

  await forEachRegistryTenant(options?.tenantDbName, async (conn, row) => {
    const result = await haltAllActiveCampaignSends(conn, { mode: 'stop' })
    for (const h of result.halted) {
      halted.push({ tenantDbName: row.dbName, ...h })
    }
  })

  return { ok: true, halted }
}

export async function unscheduleAllScheduledCampaignSendsGlobal(options?: {
  tenantDbName?: string
}): Promise<{
  ok: true
  unscheduled: Array<{ tenantDbName: string; campaignId: string }>
}> {
  const { unscheduleAllScheduledCampaignSends } = await import(
    '@server/services/campaign-send-control.service'
  )

  const unscheduled: Array<{ tenantDbName: string; campaignId: string }> = []

  await forEachRegistryTenant(options?.tenantDbName, async (conn, row) => {
    const result = await unscheduleAllScheduledCampaignSends(conn)
    for (const u of result.unscheduled) {
      unscheduled.push({ tenantDbName: row.dbName, ...u })
    }
  })

  return { ok: true, unscheduled }
}

/** Stop in-progress sends and cancel scheduled sends across tenants (or one tenant). */
export async function cancelAllActiveCampaignSendsGlobal(options?: {
  tenantDbName?: string
}): Promise<{
  ok: true
  halted: Array<{
    tenantDbName: string
    campaignId: string
    status: string
    pending: number
    sent: number
    failed: number
  }>
  unscheduled: Array<{ tenantDbName: string; campaignId: string }>
}> {
  const halted = await haltAllActiveCampaignSendsGlobal(options)
  const unscheduled = await unscheduleAllScheduledCampaignSendsGlobal(options)
  return { ok: true, halted: halted.halted, unscheduled: unscheduled.unscheduled }
}
