import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import {
  normalizeRecipientListDoc,
  suggestFilterRowsFromCriteria
} from '@server/utils/recipient/recipientListDocument'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'

function rowCriterionDisplay(
  filterDoc: Record<string, unknown>,
  listPropertyValue: string
): { property: string; value: string } {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(filterDoc)
  const registryVal =
    typeof filterDoc.propertyValue === 'string' ? filterDoc.propertyValue.trim() : ''
  const value = (listPropertyValue || registryVal).trim()
  let prop = String(property || 'unknown').trim() || 'unknown'
  if (property === 'address') {
    if (propertyType === 'state') prop = 'state'
    else if (propertyType === 'city') prop = 'city'
    else if (propertyType === 'county') prop = 'county'
    else if (propertyType === 'street') prop = 'street'
  }
  return { property: prop, value }
}

const MAX_PAGE_SIZE = 100
type RecipientListDoc = {
  _id: mongoose.Types.ObjectId
  name?: string
  listType?: string
  createdAt?: Date | null
  updatedAt?: Date | null
} & Record<string, unknown>

type RecipientListMemberRow = {
  contactId?: mongoose.Types.ObjectId | null
}

type ContactRow = {
  _id: mongoose.Types.ObjectId
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string | null
  contactType?: string[]
  company?: string | null
  channel?: string | null
  source?: string | null
  address?: Record<string, unknown> | null
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const listId = new mongoose.Types.ObjectId(rawId)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { RecipientList, RecipientListMember, Contact, RecipientFilter } =
    getTenantClientModels(tenantConn)

  const doc = (await RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth)
  )
    .lean()
    .exec()) as RecipientListDoc | null
  if (!doc) {
    throw createError({ statusCode: 404, message: 'List not found' })
  }

  const { audience, filters, filterMode, criterionJoins } = normalizeRecipientListDoc(doc)

  const storedRowsRaw = (doc as { filterRows?: unknown }).filterRows
  let filterRows: { recipientFilterId: string; listPropertyValue: string }[] = []
  if (Array.isArray(storedRowsRaw)) {
    for (const r of storedRowsRaw) {
      if (!r || typeof r !== 'object') continue
      const row = r as Record<string, unknown>
      const recipientFilterId =
        typeof row.recipientFilterId === 'string' ? row.recipientFilterId.trim() : ''
      if (!recipientFilterId) continue
      filterRows.push({
        recipientFilterId,
        listPropertyValue:
          typeof row.listPropertyValue === 'string' ? row.listPropertyValue.trim() : ''
      })
    }
  }

  if (!filterRows.length && filters.length) {
    const registryDocs = await RecipientFilter.find({
      enabled: true,
      contactType: audience
    })
      .lean()
      .exec()
    filterRows = suggestFilterRowsFromCriteria(
      audience,
      filters,
      registryDocs as Record<string, unknown>[]
    )
  }

  const needJoins = Math.max(0, filterRows.length - 1)
  const rawJoins = doc.criterionJoins as unknown
  let chainJoins: ('and' | 'or')[] | null = null
  if (needJoins === 0) {
    chainJoins = []
  } else if (Array.isArray(rawJoins) && rawJoins.length === needJoins) {
    chainJoins = rawJoins.map((x) => (x === 'or' ? 'or' : ('and' as const)))
  }

  let criteriaChain: {
    rows: { property: string; value: string }[]
    joins: ('and' | 'or')[] | null
  } | null = null
  if (filterRows.length > 0) {
    const rowIds = filterRows
      .map((r) => r.recipientFilterId)
      .filter((id) => mongoose.isValidObjectId(id))
    const filterDocs =
      rowIds.length > 0
        ? await RecipientFilter.find({
            _id: { $in: rowIds.map((id) => new mongoose.Types.ObjectId(id)) }
          })
            .lean()
            .exec()
        : []
    const byId = new Map(
      (filterDocs as Record<string, unknown>[]).map((d) => [String(d._id), d as Record<string, unknown>])
    )
    const rows: { property: string; value: string }[] = []
    for (const fr of filterRows) {
      const fd = byId.get(fr.recipientFilterId)
      if (!fd) {
        rows.push({
          property: 'filter',
          value: fr.listPropertyValue || fr.recipientFilterId
        })
        continue
      }
      rows.push(rowCriterionDisplay(fd, fr.listPropertyValue))
    }
    criteriaChain = { rows, joins: chainJoins }
  }

  const query = getQuery(event)
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50)
  )
  const skip = (page - 1) * pageSize

  const memberContactIdsRaw = await RecipientListMember.distinct('contactId', {
    recipientListId: listId
  })
  const memberObjectIds = memberContactIdsRaw
    .map((id) => {
      if (id == null) return null
      const s = String(id)
      return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : null
    })
    .filter((x): x is mongoose.Types.ObjectId => x != null)

  const memberTotal =
    memberObjectIds.length === 0
      ? 0
      : await Contact.countDocuments(
          mergeTenantOwnerEmailScopeFilter(
            { _id: { $in: memberObjectIds }, deletedAt: null },
            auth
          )
        )

  const memberRows = (await RecipientListMember.find({ recipientListId: listId })
    .select('contactId')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(pageSize)
    .lean()
    .exec()) as RecipientListMemberRow[]

  const contactIds = memberRows.map((m) => m.contactId).filter(Boolean)

  const contactByIdsFilter = mergeTenantOwnerEmailScopeFilter(
    {
      _id: { $in: contactIds },
      deletedAt: null
    },
    auth
  )

  const contacts: ContactRow[] =
    contactIds.length === 0
      ? []
      : ((await Contact.find(contactByIdsFilter)
          .select({
            firstName: 1,
            lastName: 1,
            name: 1,
            email: 1,
            phone: 1,
            contactType: 1,
            company: 1,
            channel: 1,
            source: 1,
            address: 1
          })
          .lean()
          .exec()) as ContactRow[])

  const byId = new Map(contacts.map((c) => [String(c._id), c]))
  const items = contactIds
    .map((cid) => byId.get(String(cid)))
    .filter(Boolean)
    .map((c) => {
      const { firstName, lastName } = contactFirstLastFromDoc(c!)
      return {
        id: String(c!._id),
        firstName,
        lastName,
        name: formatContactFullName(firstName, lastName),
        email: c!.email ?? '',
        phone: c!.phone ?? '',
        contactType:
          Array.isArray(c!.contactType) && c!.contactType.length
            ? [...new Set(c!.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean))]
            : [],
        company: c!.company ?? '',
        channel: c!.channel ?? '',
        source: c!.source ?? '',
        address: c!.address ?? {}
      }
    })

  return {
    list: {
      id: String(doc._id),
      name: doc.name ?? '',
      listType: doc.listType ?? '',
      audience,
      filters,
      filterMode,
      criterionJoins: criterionJoins ?? [],
      criteriaChain,
      filterRows,
      membershipScope:
        doc.membershipScope === 'tenant' || doc.membershipScope === 'owner_emails'
          ? doc.membershipScope
          : 'owner_emails',
      membershipOwnerEmails: recipientListStoredMembershipEmails(
        doc as { membershipOwnerEmails?: unknown }
      ),
      createdAt: doc.createdAt?.toISOString?.() ?? null,
      updatedAt: doc.updatedAt?.toISOString?.() ?? null
    },
    members: {
      items,
      total: memberTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(memberTotal / pageSize))
    }
  }
})
