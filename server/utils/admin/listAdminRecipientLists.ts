import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { adminContactPageWindows } from '@server/utils/admin/adminContactPageWindows'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { campaignCreatorLabel } from '../../../shared/campaignCreatorLabel'

export type AdminRecipientListItem = {
  id: string
  tenantDbName: string
  tenantName: string
  name: string
  memberCount: number
  builtBy: string
  updatedAt: string
}

type ListLean = {
  _id: unknown
  name?: string
  createdBy?: string
  metadata?: { ownerEmail?: string }
  updatedAt?: Date
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function listQuery(search: string): Record<string, unknown> {
  const q = search.trim()
  if (!q) return {}
  const rx = new RegExp(escapeRegex(q), 'i')
  return {
    $or: [{ name: rx }, { 'metadata.ownerEmail': rx }, { createdBy: rx }]
  }
}

async function memberCounts(
  conn: Connection,
  ids: unknown[]
): Promise<Map<string, number>> {
  const objectIds = ids
    .map((id) => String(id ?? '').trim())
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id))
  const counts = new Map<string, number>()
  if (!objectIds.length) return counts
  const { RecipientListMember } = getTenantClientModels(conn)
  const rows = await RecipientListMember.aggregate<{ _id: unknown; count: number }>([
    { $match: { recipientListId: { $in: objectIds } } },
    { $group: { _id: '$recipientListId', count: { $sum: 1 } } }
  ])
  for (const row of rows) {
    if (row._id != null) counts.set(String(row._id), row.count)
  }
  return counts
}

/** Recipient lists across tenants, ordered by tenant name then most recently updated. */
export async function listAdminRecipientLists(options?: {
  tenantDbName?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{
  lists: AdminRecipientListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const search = String(options?.search ?? '').trim()
  const tenantFilter = String(options?.tenantDbName ?? '').trim()
  const page = Math.max(1, Math.floor(Number(options?.page) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.limit) || 25)))
  const filter = listQuery(search)

  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]
  const tenants = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .filter((t) => !tenantFilter || t.dbName === tenantFilter)
    .sort((a, b) => a.name.localeCompare(b.name))

  const slices: Array<{
    tenant: { dbName: string; name: string }
    conn: Connection
    total: number
  }> = []

  for (const tenant of tenants) {
    let conn: Connection
    try {
      conn = await getTenantConnectionByDbName(tenant.dbName)
    } catch {
      continue
    }
    try {
      const { RecipientList } = getTenantClientModels(conn)
      const total = await RecipientList.countDocuments(filter)
      slices.push({ tenant: { dbName: tenant.dbName, name: tenant.name }, conn, total })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminRecipientLists] count skip tenant', { dbName: tenant.dbName, message })
    }
  }

  const total = slices.reduce((sum, slice) => sum + slice.total, 0)
  const windows = adminContactPageWindows(
    slices.map((slice) => slice.total),
    (page - 1) * limit,
    limit
  )

  const lists: AdminRecipientListItem[] = []
  for (const window of windows) {
    const slice = slices[window.index]
    if (!slice) continue
    try {
      const { RecipientList } = getTenantClientModels(slice.conn)
      const docs = await RecipientList.find(filter)
        .select('name createdBy metadata updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(window.skip)
        .limit(window.limit)
        .lean<ListLean[]>()
      const counts = await memberCounts(
        slice.conn,
        docs.map((doc) => doc._id)
      )
      for (const doc of docs) {
        const id = String(doc._id)
        lists.push({
          id,
          tenantDbName: slice.tenant.dbName,
          tenantName: slice.tenant.name,
          name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Untitled',
          memberCount: counts.get(id) ?? 0,
          builtBy: campaignCreatorLabel({
            ownerEmail: doc.metadata?.ownerEmail,
            createdBy: doc.createdBy
          }),
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : ''
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminRecipientLists] list skip tenant', {
        dbName: slice.tenant.dbName,
        message
      })
    }
  }

  return {
    lists,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
}
