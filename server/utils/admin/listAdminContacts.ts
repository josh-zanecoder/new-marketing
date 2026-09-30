import type { Connection } from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { adminContactPageWindows } from '@server/utils/admin/adminContactPageWindows'

export type AdminContactListItem = {
  id: string
  tenantDbName: string
  tenantName: string
  name: string
  email: string
  phone: string
  company: string
  isUnsubscribe: boolean
  updatedAt: string
}

type ContactLean = {
  _id: unknown
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  isUnsubscribe?: boolean
  updatedAt?: Date
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function contactQuery(search: string, subscription: string): Record<string, unknown> {
  const filter: Record<string, unknown> = { deletedAt: null }
  if (subscription === 'subscribed') filter.isUnsubscribe = { $ne: true }
  if (subscription === 'unsubscribed') filter.isUnsubscribe = true
  const q = search.trim()
  if (!q) return filter
  const rx = new RegExp(escapeRegex(q), 'i')
  filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }, { company: rx }, { phone: rx }]
  return filter
}

function toListItem(
  doc: ContactLean,
  tenant: { dbName: string; name: string }
): AdminContactListItem {
  const { firstName, lastName } = contactFirstLastFromDoc(doc)
  return {
    id: String(doc._id),
    tenantDbName: tenant.dbName,
    tenantName: tenant.name,
    name: formatContactFullName(firstName, lastName),
    email: doc.email ?? '',
    phone: doc.phone ?? '',
    company: doc.company ?? '',
    isUnsubscribe: doc.isUnsubscribe === true,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : ''
  }
}

/** Contacts across tenants, ordered by tenant name then most recently updated. */
export async function listAdminContacts(options?: {
  tenantDbName?: string
  search?: string
  subscription?: string
  page?: number
  limit?: number
}): Promise<{
  contacts: AdminContactListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const search = String(options?.search ?? '').trim()
  const subscription = String(options?.subscription ?? 'all').trim() || 'all'
  const tenantFilter = String(options?.tenantDbName ?? '').trim()
  const page = Math.max(1, Math.floor(Number(options?.page) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.limit) || 25)))
  const filter = contactQuery(search, subscription)

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
      const { Contact } = getTenantClientModels(conn)
      const total = await Contact.countDocuments(filter)
      slices.push({ tenant: { dbName: tenant.dbName, name: tenant.name }, conn, total })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminContacts] count skip tenant', { dbName: tenant.dbName, message })
    }
  }

  const total = slices.reduce((sum, slice) => sum + slice.total, 0)
  const windows = adminContactPageWindows(
    slices.map((slice) => slice.total),
    (page - 1) * limit,
    limit
  )

  const contacts: AdminContactListItem[] = []
  for (const window of windows) {
    const slice = slices[window.index]
    if (!slice) continue
    try {
      const { Contact } = getTenantClientModels(slice.conn)
      const docs = await Contact.find(filter)
        .select('firstName lastName email phone company isUnsubscribe updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(window.skip)
        .limit(window.limit)
        .lean<ContactLean[]>()
      for (const doc of docs) contacts.push(toListItem(doc, slice.tenant))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminContacts] list skip tenant', { dbName: slice.tenant.dbName, message })
    }
  }

  return {
    contacts,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
}
