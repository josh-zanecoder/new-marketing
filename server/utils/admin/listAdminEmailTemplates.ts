import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { adminContactPageWindows } from '@server/utils/admin/adminContactPageWindows'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

export type AdminEmailTemplateCampaign = {
  id: string
  name: string
  status: string
}

export type AdminEmailTemplateListItem = {
  id: string
  tenantDbName: string
  tenantName: string
  name: string
  subject: string
  htmlSource: string
  inLibrary: boolean
  updatedAt: string
  campaignCount: number
  campaigns: AdminEmailTemplateCampaign[]
}

const CAMPAIGNS_PER_TEMPLATE = 8

type TemplateLean = {
  _id: unknown
  name?: string
  subject?: string
  htmlSource?: string
  saveToLibrary?: boolean
  updatedAt?: Date
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function templateQuery(search: string): Record<string, unknown> {
  const filter: Record<string, unknown> = { deletedAt: null }
  const q = search.trim()
  if (!q) return filter
  const rx = new RegExp(escapeRegex(q), 'i')
  filter.$or = [{ name: rx }, { subject: rx }]
  return filter
}

async function campaignsForTemplates(
  conn: Connection,
  ids: string[]
): Promise<Map<string, { count: number; campaigns: AdminEmailTemplateCampaign[] }>> {
  const out = new Map<string, { count: number; campaigns: AdminEmailTemplateCampaign[] }>()
  const objectIds = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id))
  if (!objectIds.length) return out
  const { Campaign } = getTenantClientModels(conn)
  const docs = await Campaign.find({ emailTemplate: { $in: objectIds } })
    .select('name status emailTemplate')
    .sort({ updatedAt: -1 })
    .lean<Array<{ _id: unknown; name?: string; status?: string; emailTemplate?: unknown }>>()
  for (const doc of docs) {
    const key = String(doc.emailTemplate ?? '')
    if (!key) continue
    const bucket = out.get(key) ?? { count: 0, campaigns: [] }
    bucket.count += 1
    if (bucket.campaigns.length < CAMPAIGNS_PER_TEMPLATE) {
      bucket.campaigns.push({
        id: String(doc._id),
        name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Untitled',
        status: String(doc.status ?? '')
      })
    }
    out.set(key, bucket)
  }
  return out
}

/** Active email designs across tenants, including campaign-only templates. */
export async function listAdminEmailTemplates(options?: {
  tenantDbName?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{
  templates: AdminEmailTemplateListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}> {
  const search = String(options?.search ?? '').trim()
  const tenantFilter = String(options?.tenantDbName ?? '').trim()
  const page = Math.max(1, Math.floor(Number(options?.page) || 1))
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.limit) || 25)))
  const filter = templateQuery(search)

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
      const { EmailTemplate } = getTenantClientModels(conn)
      const total = await EmailTemplate.countDocuments(filter)
      slices.push({ tenant: { dbName: tenant.dbName, name: tenant.name }, conn, total })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminEmailTemplates] count skip tenant', { dbName: tenant.dbName, message })
    }
  }

  const total = slices.reduce((sum, slice) => sum + slice.total, 0)
  const windows = adminContactPageWindows(
    slices.map((slice) => slice.total),
    (page - 1) * limit,
    limit
  )

  const templates: AdminEmailTemplateListItem[] = []
  for (const window of windows) {
    const slice = slices[window.index]
    if (!slice) continue
    try {
      const { EmailTemplate } = getTenantClientModels(slice.conn)
      const docs = await EmailTemplate.find(filter)
        .select('name subject htmlSource saveToLibrary updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(window.skip)
        .limit(window.limit)
        .lean<TemplateLean[]>()
      const usage = await campaignsForTemplates(
        slice.conn,
        docs.map((doc) => String(doc._id))
      )
      for (const doc of docs) {
        const id = String(doc._id)
        const used = usage.get(id)
        templates.push({
          id,
          tenantDbName: slice.tenant.dbName,
          tenantName: slice.tenant.name,
          name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Untitled',
          subject: typeof doc.subject === 'string' ? doc.subject : '',
          htmlSource: typeof doc.htmlSource === 'string' ? doc.htmlSource : 'editor',
          inLibrary: doc.saveToLibrary !== false,
          updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
          campaignCount: used?.count ?? 0,
          campaigns: used?.campaigns ?? []
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[AdminEmailTemplates] list skip tenant', {
        dbName: slice.tenant.dbName,
        message
      })
    }
  }

  return {
    templates,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
}

export async function fetchAdminEmailTemplatePreview(
  tenantDbName: string,
  templateId: string
): Promise<{ name: string; subject: string; html: string }> {
  const dbName = tenantDbName.trim()
  const id = templateId.trim()
  if (!dbName) throw createError({ statusCode: 400, message: 'Tenant is required' })
  if (!mongoose.isValidObjectId(id)) {
    throw createError({ statusCode: 400, message: 'Template id is required' })
  }
  const conn = await getTenantConnectionByDbName(dbName)
  const { EmailTemplate } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel
  const doc = await model
    .findOne({ _id: id, deletedAt: null })
    .select('name subject htmlTemplate')
    .lean<{ name?: string; subject?: string; htmlTemplate?: string } | null>()
  if (!doc) throw createError({ statusCode: 404, message: 'Template not found' })
  const html = await materializeEmailTemplateHtmlIfNeeded({
    EmailTemplate: model,
    id,
    htmlTemplate: doc.htmlTemplate ?? ''
  })
  return {
    name: typeof doc.name === 'string' ? doc.name : 'Untitled',
    subject: typeof doc.subject === 'string' ? doc.subject : '',
    html
  }
}
