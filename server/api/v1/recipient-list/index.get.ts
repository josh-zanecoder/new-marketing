import { getRegistryConnection } from '../../../lib/mongoose'
import { getRecipientFilterModel } from '../../../models/registry/RecipientFilter'
import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../tenant/connection'
import { canonicalRecipientFilterFieldsFromDoc } from '../../../utils/recipientFilterValidation'
import { normalizeRecipientListDoc } from '../../../utils/recipientListDocument'

const CONTACT_LIMIT = 3000

function serializeRegistryFilter(f: {
  _id: unknown
  tenantId: string
  name: string
  contactType: string
  property?: string
  propertyType?: string | null
  propertyValue?: string
  enabled: boolean
  createdAt?: Date
  updatedAt?: Date
}) {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(f)
  return {
    id: String(f._id),
    tenantId: f.tenantId,
    name: f.name,
    contactType: f.contactType,
    property,
    propertyType,
    propertyValue: f.propertyValue ?? '',
    enabled: f.enabled,
    createdAt: f.createdAt?.toISOString?.() ?? null,
    updatedAt: f.updatedAt?.toISOString?.() ?? null
  }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { Contact, RecipientList } = getTenantClientModels(tenantConn)

  const [contactTotal, contacts, kindCounts, lists] = await Promise.all([
    Contact.countDocuments({ deletedAt: null }),
    Contact.find({ deletedAt: null })
      .select({
        name: 1,
        email: 1,
        contactKind: 1,
        company: 1,
        channel: 1,
        source: 1,
        address: 1
      })
      .sort({ updatedAt: -1 })
      .limit(CONTACT_LIMIT)
      .lean()
      .exec(),
    Contact.aggregate<{ _id: string; count: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$contactKind', count: { $sum: 1 } } }
    ]).exec(),
    RecipientList.find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean()
      .exec()
  ])

  const byKind: Record<string, number> = {}
  for (const row of kindCounts) {
    if (row._id) byKind[String(row._id)] = row.count
  }

  let recipientFilters: ReturnType<typeof serializeRegistryFilter>[] = []
  if (tenantId) {
    const FilterModel = getRecipientFilterModel(registryConn)
    const docs = await FilterModel.find({ tenantId, enabled: true })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
    recipientFilters = docs.map(serializeRegistryFilter)
  }

  return {
    tenantId,
    tenantIdConfigured: Boolean(tenantId),
    contacts: contacts.map((c) => ({
      id: String(c._id),
      name: c.name,
      email: c.email,
      contactKind: c.contactKind,
      company: c.company ?? '',
      channel: c.channel ?? '',
      source: c.source ?? '',
      address: c.address ?? {}
    })),
    contactTotal,
    contactsTruncated: contactTotal > CONTACT_LIMIT,
    contactCounts: {
      prospect: byKind.prospect ?? 0,
      client: byKind.client ?? 0,
      contact: byKind.contact ?? 0
    },
    recipientFilters,
    lists: lists.map((doc) => {
      const { audience, filters } = normalizeRecipientListDoc(
        doc as Record<string, unknown>
      )
      return {
        id: String(doc._id),
        name: doc.name,
        listType: doc.listType,
        audience,
        filters,
        createdAt: doc.createdAt?.toISOString?.() ?? null,
        updatedAt: doc.updatedAt?.toISOString?.() ?? null
      }
    })
  }
})
