import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListNormalization'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'

const CONTACT_LIMIT = 3000
type ContactRow = {
  _id: unknown
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  contactType?: string[]
  company?: string | null
  channel?: string | null
  source?: string | null
  address?: Record<string, unknown> | null
}

type RecipientListDoc = {
  _id: unknown
  name?: string
  listType?: string
  createdAt?: Date | null
  updatedAt?: Date | null
} & Record<string, unknown>

function serializeRegistryFilter(
  f: {
    _id: unknown
    name: string
    contactType: string
    property?: string
    propertyType?: string | null
    propertyValue?: string
    enabled: boolean
    createdAt?: Date
    updatedAt?: Date
  },
  registryTenantId: string | null
) {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(f)
  return {
    id: String(f._id),
    tenantId: registryTenantId ?? '',
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

type ContactTypeLean = {
  key?: string
  label?: string
  sortOrder?: number
}

async function buildRecipientListFormMetadata(params: {
  tenantConn: Connection
  auth: unknown
  tenantId: string | null
  contactTypeDocs: unknown[]
  distinctContactTypes: unknown[]
  filterDocsRaw: unknown[]
}) {
  const { Contact } = getTenantClientModels(params.tenantConn)
  const contactFilter = mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, params.auth)

  const contactTypes = (params.contactTypeDocs as ContactTypeLean[]).map((d) => {
    const key = String(d.key ?? '').trim().toLowerCase()
    const label = String(d.label ?? '').trim() || key
    return {
      key,
      label,
      sortOrder: Number(d.sortOrder ?? 0)
    }
  })

  const countKeySet = new Set<string>()
  for (const t of contactTypes) {
    if (t.key) countKeySet.add(t.key)
  }
  for (const row of params.distinctContactTypes as unknown[]) {
    const k = String(row).trim().toLowerCase()
    if (k) countKeySet.add(k)
  }
  for (const d of params.filterDocsRaw as { contactType?: string }[]) {
    const k = String(d.contactType ?? '')
      .trim()
      .toLowerCase()
    if (k) countKeySet.add(k)
  }
  const countKeys = [...countKeySet].sort((a, b) => a.localeCompare(b))
  const contactCounts: Record<string, number> = {}
  await Promise.all(
    countKeys.map(async (key) => {
      contactCounts[key] = await Contact.countDocuments({
        ...contactFilter,
        contactType: key
      })
    })
  )

  const recipientFilters = (params.filterDocsRaw as unknown[]).map((d) =>
    serializeRegistryFilter(
      d as unknown as Parameters<typeof serializeRegistryFilter>[0],
      params.tenantId
    )
  )

  return { contactTypes, contactCounts, recipientFilters }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { Contact, RecipientList, RecipientListMember, RecipientFilter: FilterModel, ContactType } =
    getTenantClientModels(tenantConn)

  const contactFilter = mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, auth)

  /** `scope=form` — contact types, registry filters, per-type counts only (create/edit list form). */
  const scopeParam = getQuery(event).scope
  const scope = Array.isArray(scopeParam) ? scopeParam[0] : scopeParam
  if (String(scope ?? '').toLowerCase() === 'form') {
    const [contactTypeDocs, distinctContactTypes, filterDocsRaw] = await Promise.all([
      ContactType.find({ enabled: { $ne: false } })
        .sort({ sortOrder: 1, key: 1 })
        .lean()
        .exec(),
      Contact.distinct('contactType', contactFilter),
      FilterModel.find({ enabled: true }).sort({ updatedAt: -1 }).lean().exec()
    ])
    const meta = await buildRecipientListFormMetadata({
      tenantConn,
      auth,
      tenantId,
      contactTypeDocs,
      distinctContactTypes,
      filterDocsRaw
    })
    return {
      tenantId,
      tenantIdConfigured: Boolean(tenantId),
      ...meta,
      contacts: [],
      contactTotal: 0,
      contactsTruncated: false,
      lists: []
    }
  }

  const [
    contactTotal,
    contactsRaw,
    listsRaw,
    contactTypeDocs,
    distinctContactTypes,
    filterDocsRaw
  ] = await Promise.all([
    Contact.countDocuments(contactFilter),
    Contact.find(contactFilter)
      .select({
        firstName: 1,
        lastName: 1,
        name: 1,
        email: 1,
        contactType: 1,
        company: 1,
        channel: 1,
        source: 1,
        address: 1
      })
      .sort({ updatedAt: -1 })
      .limit(CONTACT_LIMIT)
      .lean()
      .exec(),
    RecipientList.find(mergeTenantOwnerEmailScopeFilter({}, auth))
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean()
      .exec(),
    ContactType.find({ enabled: { $ne: false } })
      .sort({ sortOrder: 1, key: 1 })
      .lean()
      .exec(),
    Contact.distinct('contactType', contactFilter),
    FilterModel.find({ enabled: true }).sort({ updatedAt: -1 }).lean().exec()
  ])
  const contacts = contactsRaw as ContactRow[]
  const lists = listsRaw as RecipientListDoc[]

  const listObjectIds = lists
    .map((d) => d._id)
    .filter((id) => id != null && mongoose.isValidObjectId(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)))

  const memberCountByListId = new Map<string, number>()
  if (listObjectIds.length > 0) {
    const countRows = await RecipientListMember.aggregate<{
      _id: mongoose.Types.ObjectId
      count: number
    }>([
      { $match: { recipientListId: { $in: listObjectIds } } },
      {
        $lookup: {
          from: Contact.collection.name,
          let: { cid: '$contactId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $match: contactFilter as Record<string, unknown> }
          ],
          as: '_memberContact'
        }
      },
      { $match: { _memberContact: { $ne: [] } } },
      { $group: { _id: '$recipientListId', count: { $sum: 1 } } }
    ]).exec()
    for (const row of countRows) {
      if (row._id) memberCountByListId.set(String(row._id), row.count)
    }
  }

  const { contactTypes, contactCounts, recipientFilters } = await buildRecipientListFormMetadata({
    tenantConn,
    auth,
    tenantId,
    contactTypeDocs,
    distinctContactTypes,
    filterDocsRaw
  })

  return {
    tenantId,
    tenantIdConfigured: Boolean(tenantId),
    contacts: contacts.map((c) => {
      const { firstName, lastName } = contactFirstLastFromDoc(c)
      const keys =
        Array.isArray(c.contactType) && c.contactType.length
          ? [...new Set(c.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean))]
          : []
      return {
        id: String(c._id),
        firstName,
        lastName,
        name: formatContactFullName(firstName, lastName),
        email: c.email ?? '',
        contactType: keys,
        company: c.company ?? '',
        channel: c.channel ?? '',
        source: c.source ?? '',
        address: c.address ?? {}
      }
    }),
    contactTotal,
    contactsTruncated: contactTotal > CONTACT_LIMIT,
    contactCounts,
    contactTypes,
    recipientFilters,
    lists: lists.map((doc) => {
      const { audience, filters, filterMode, criterionJoins } = normalizeRecipientListDoc(doc)
      return {
        id: String(doc._id),
        name: doc.name ?? '',
        listType: doc.listType ?? '',
        audience,
        filters,
        filterMode,
        criterionJoins: criterionJoins ?? [],
        membershipScope:
          doc.membershipScope === 'tenant' || doc.membershipScope === 'owner_emails'
            ? doc.membershipScope
            : 'owner_emails',
        membershipOwnerEmails: recipientListStoredMembershipEmails(
          doc as { membershipOwnerEmails?: unknown }
        ),
        memberCount: memberCountByListId.get(String(doc._id)) ?? 0,
        createdAt: doc.createdAt?.toISOString?.() ?? null,
        updatedAt: doc.updatedAt?.toISOString?.() ?? null
      }
    })
  }
})
