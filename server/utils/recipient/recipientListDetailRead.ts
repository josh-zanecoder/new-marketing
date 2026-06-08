import mongoose from 'mongoose'
import type { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { criterionDisplayFromRegistryFilter } from '@server/utils/recipient/recipientCriterionDisplay'
import {
  normalizeRecipientListDoc,
  suggestFilterRowsFromCriteria
} from '@server/utils/recipient/recipientListNormalization'
import { recipientFilterContactTypeMatch } from '@server/utils/recipient/recipientListAudience'
import { recipientListStoredMembershipEmails } from '@server/utils/recipient/recipientListMutation'
import type { RecipientListLeanDoc } from '@server/utils/recipient/recipientListSerialization'
import { countVisibleMembersForList } from '@server/utils/recipient/recipientListMemberCounts'

export const RECIPIENT_LIST_MEMBERS_MAX_PAGE_SIZE = 100

type RecipientListMemberLean = { contactId?: mongoose.Types.ObjectId | null }

type MemberContactRow = {
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

export type RecipientListDetailModels = Pick<
  ReturnType<typeof getTenantClientModels>,
  'RecipientListMember' | 'Contact' | 'RecipientFilter'
>

export function parseMembersPageQuery(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(
    RECIPIENT_LIST_MEMBERS_MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50)
  )
  return { page, pageSize }
}

export function filterRowsFromDoc(doc: RecipientListLeanDoc) {
  const storedRowsRaw = (doc as { filterRows?: unknown }).filterRows
  const filterRows: { recipientFilterId: string; listPropertyValue: string }[] = []
  if (!Array.isArray(storedRowsRaw)) return filterRows

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
  return filterRows
}

export async function resolveFilterRowsForList(
  doc: RecipientListLeanDoc,
  audience: string,
  filters: { property: string; value: string }[],
  RecipientFilter: RecipientListDetailModels['RecipientFilter']
) {
  let filterRows = filterRowsFromDoc(doc)
  if (filterRows.length || !filters.length) return filterRows

  const registryDocs = await RecipientFilter.find({
    enabled: true,
    ...recipientFilterContactTypeMatch(audience)
  })
    .lean()
    .exec()

  return suggestFilterRowsFromCriteria(audience, filters, registryDocs as Record<string, unknown>[])
}

function criterionJoinsFromDoc(doc: RecipientListLeanDoc, filterRowCount: number) {
  const needJoins = Math.max(0, filterRowCount - 1)
  const rawJoins = doc.criterionJoins as unknown
  if (needJoins === 0) return [] as ('and' | 'or')[]
  if (!Array.isArray(rawJoins) || rawJoins.length !== needJoins) return null
  return rawJoins.map((x) => (x === 'or' ? 'or' : ('and' as const)))
}

export async function buildCriteriaChainForList(
  doc: RecipientListLeanDoc,
  audience: string,
  filters: { property: string; value: string }[],
  RecipientFilter: RecipientListDetailModels['RecipientFilter']
) {
  const filterRows = await resolveFilterRowsForList(doc, audience, filters, RecipientFilter)
  const chainJoins = criterionJoinsFromDoc(doc, filterRows.length)

  if (!filterRows.length) {
    return { criteriaChain: null, filterRows }
  }

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

  const rows = filterRows.map((fr) => {
    const fd = byId.get(fr.recipientFilterId)
    if (!fd) {
      return {
        property: 'filter',
        value: fr.listPropertyValue || fr.recipientFilterId
      }
    }
    return criterionDisplayFromRegistryFilter(fd, fr.listPropertyValue)
  })

  return {
    criteriaChain: { rows, joins: chainJoins },
    filterRows
  }
}

export function serializeListDetailHeader(
  doc: RecipientListLeanDoc,
  extras?: {
    criteriaChain?: {
      rows: { property: string; value: string }[]
      joins: ('and' | 'or')[] | null
    } | null
    filterRows?: { recipientFilterId: string; listPropertyValue: string }[]
  }
) {
  const { audience, filters, filterMode, criterionJoins } = normalizeRecipientListDoc(doc)
  return {
    id: String(doc._id),
    name: doc.name ?? '',
    listType: doc.listType ?? '',
    audience,
    filters,
    filterMode,
    criterionJoins: criterionJoins ?? [],
    criteriaChain: extras?.criteriaChain ?? null,
    filterRows: extras?.filterRows ?? [],
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
}

export async function loadRecipientListMembersPage(params: {
  models: RecipientListDetailModels
  listId: mongoose.Types.ObjectId
  auth: unknown
  page: number
  pageSize: number
}) {
  const { RecipientListMember, Contact } = params.models
  const contactFilter = mergeTenantOwnerEmailScopeFilter(
    withMarketableContactFilter({}),
    params.auth
  ) as Record<string, unknown>

  const [memberTotal, memberRows] = await Promise.all([
    countVisibleMembersForList({
      RecipientListMember,
      Contact,
      listId: params.listId,
      contactFilter
    }),
    RecipientListMember.find({ recipientListId: params.listId })
      .select('contactId')
      .sort({ createdAt: 1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean()
      .exec()
  ])

  const contactIds = (memberRows as RecipientListMemberLean[])
    .map((m) => m.contactId)
    .filter(Boolean)

  const contacts: MemberContactRow[] =
    contactIds.length === 0
      ? []
      : ((await Contact.find(
          mergeTenantOwnerEmailScopeFilter(
            withMarketableContactFilter({ _id: { $in: contactIds } }),
            params.auth
          )
        )
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
          .exec()) as MemberContactRow[])

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
    items,
    total: memberTotal,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(memberTotal / params.pageSize))
  }
}
