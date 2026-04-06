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
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListDocument'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'

const CONTACT_LIMIT = 3000
type ContactRow = {
  _id: unknown
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  contactKind?: string
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

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { Contact, RecipientList, RecipientFilter: FilterModel } =
    getTenantClientModels(tenantConn)

  const contactFilter = mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, auth)

  const [contactTotal, contactsRaw, kindCounts, listsRaw] = await Promise.all([
    Contact.countDocuments(contactFilter),
    Contact.find(contactFilter)
      .select({
        firstName: 1,
        lastName: 1,
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
      { $match: contactFilter },
      { $group: { _id: '$contactKind', count: { $sum: 1 } } }
    ]).exec(),
    RecipientList.find(mergeTenantOwnerEmailScopeFilter({}, auth))
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean()
      .exec()
  ])
  const contacts = contactsRaw as ContactRow[]
  const lists = listsRaw as RecipientListDoc[]

  const byKind: Record<string, number> = {}
  for (const row of kindCounts) {
    if (row._id) byKind[String(row._id)] = row.count
  }

  let recipientFilters: ReturnType<typeof serializeRegistryFilter>[] = []
  const docs = await FilterModel.find({ enabled: true })
    .sort({ updatedAt: -1 })
    .lean()
    .exec()
  recipientFilters = docs.map((d) =>
    serializeRegistryFilter(
      d as unknown as Parameters<typeof serializeRegistryFilter>[0],
      tenantId
    )
  )

  return {
    tenantId,
    tenantIdConfigured: Boolean(tenantId),
    contacts: contacts.map((c) => {
      const { firstName, lastName } = contactFirstLastFromDoc(c)
      return {
        id: String(c._id),
        firstName,
        lastName,
        name: formatContactFullName(firstName, lastName),
        email: c.email ?? '',
        contactKind: c.contactKind ?? '',
        company: c.company ?? '',
        channel: c.channel ?? '',
        source: c.source ?? '',
        address: c.address ?? {}
      }
    }),
    contactTotal,
    contactsTruncated: contactTotal > CONTACT_LIMIT,
    contactCounts: {
      prospect: byKind.prospect ?? 0,
      client: byKind.client ?? 0,
      contact: byKind.contact ?? 0
    },
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
        createdAt: doc.createdAt?.toISOString?.() ?? null,
        updatedAt: doc.updatedAt?.toISOString?.() ?? null
      }
    })
  }
})
