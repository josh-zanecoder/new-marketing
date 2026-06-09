import type { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { buildContactListSearchFilter } from './contactSearchText'

export const CONTACT_LIST_MAX_PAGE_SIZE = 100
export const CONTACT_LIST_DEFAULT_PAGE_SIZE = 50
/** Guard against slow scans; list queries must stay paginated (never load all rows). */
export const CONTACT_LIST_QUERY_MAX_TIME_MS = 30_000

export const CONTACT_LIST_SELECT = {
  firstName: 1,
  lastName: 1,
  name: 1,
  email: 1,
  phone: 1,
  company: 1,
  channel: 1,
  contactType: 1,
  isUnsubscribe: 1,
  address: 1,
  createdAt: 1,
  updatedAt: 1,
  externalId: 1,
  source: 1,
  'metadata.ownerEmail': 1
} as const

type ContactDoc = {
  _id: unknown
  externalId?: string
  source?: string
  contactType?: string[]
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  company?: string
  channel?: string
  metadata?: Record<string, unknown>
  isUnsubscribe?: boolean
  address?: {
    street?: string
    city?: string
    state?: string
    county?: string
  }
  createdAt?: Date
  updatedAt?: Date
}

type ContactTypeLean = {
  key?: string
  label?: string
  enabled?: boolean
  sortOrder?: number
}

export type ContactListQuery = {
  page: number
  pageSize: number
  search: string
  subscription: 'all' | 'subscribed' | 'unsubscribed'
  contactType: string
}

export function parseContactListQuery(query: Record<string, unknown>): ContactListQuery {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(
    CONTACT_LIST_MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(query.limit ?? String(CONTACT_LIST_DEFAULT_PAGE_SIZE)), 10) || CONTACT_LIST_DEFAULT_PAGE_SIZE)
  )
  const search = String(query.search ?? query.q ?? '').trim()
  const subRaw = String(query.subscription ?? 'all').trim().toLowerCase()
  const subscription =
    subRaw === 'subscribed' || subRaw === 'unsubscribed' ? subRaw : ('all' as const)
  const contactType = String(query.contactType ?? query.type ?? 'all').trim().toLowerCase()
  return { page, pageSize, search, subscription, contactType }
}

function typeKeyDisplayLabel(keyRaw: string, labelByKey: Map<string, string>): string {
  const key = keyRaw.trim().toLowerCase()
  if (!key) return '—'
  return labelByKey.get(key) ?? keyRaw.trim()
}

function effectiveContactTypeKeys(doc: ContactDoc): string[] {
  const fromArr = Array.isArray(doc.contactType)
    ? doc.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : []
  if (fromArr.length) return [...new Set(fromArr)]
  const k = String((doc as { contactKind?: string }).contactKind ?? '').trim().toLowerCase()
  return k ? [k] : []
}

const CONTACT_TYPE_NONE = '__none__'

export function buildContactListMongoFilter(
  auth: unknown,
  query: Pick<ContactListQuery, 'search' | 'subscription' | 'contactType'>
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [
    mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, auth)
  ]

  if (query.subscription === 'subscribed') {
    clauses.push({ isUnsubscribe: { $ne: true } })
  } else if (query.subscription === 'unsubscribed') {
    clauses.push({ isUnsubscribe: true })
  }

  const type = query.contactType
  if (type && type !== 'all') {
    if (type === CONTACT_TYPE_NONE) {
      clauses.push({
        $or: [{ contactType: { $exists: false } }, { contactType: { $size: 0 } }]
      })
    } else {
      clauses.push({ contactType: type })
    }
  }

  const searchClause = buildContactListSearchFilter(query.search)
  if (searchClause) clauses.push(searchClause)

  if (clauses.length === 1) return clauses[0]!
  return { $and: clauses }
}

export function mapContactDocToListRow(
  c: ContactDoc,
  labelByKey: Map<string, string>
) {
  const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {}
  const ownerRaw = meta && typeof meta.ownerEmail === 'string' ? meta.ownerEmail : ''
  const { firstName, lastName } = contactFirstLastFromDoc(c)
  const typeKeys = effectiveContactTypeKeys(c)
  const primaryKey = typeKeys[0] || ''
  return {
    id: String(c._id),
    externalId: c.externalId ?? '',
    source: c.source ?? '',
    contactType: typeKeys,
    primaryTypeLabel: typeKeyDisplayLabel(primaryKey, labelByKey),
    contactTypeLabels: typeKeys.map((key) => typeKeyDisplayLabel(key, labelByKey)),
    firstName,
    lastName,
    name: formatContactFullName(firstName, lastName),
    email: c.email ?? '',
    phone: c.phone ?? '',
    company: c.company ?? '',
    channel: c.channel ?? '',
    ownerEmail: ownerRaw,
    address: {
      street: c.address?.street ?? '',
      city: c.address?.city ?? '',
      state: c.address?.state ?? '',
      county: c.address?.county ?? ''
    },
    is_unsubscribe: c.isUnsubscribe === true,
    createdAt: c.createdAt?.toISOString?.() ?? null,
    updatedAt: c.updatedAt?.toISOString?.() ?? null
  }
}

export async function loadContactTypeOptions(
  ContactType: ReturnType<typeof getTenantClientModels>['ContactType']
) {
  const typeDocs = await ContactType.find({ enabled: { $ne: false } })
    .sort({ sortOrder: 1, key: 1 })
    .lean<ContactTypeLean[]>()

  const labelByKey = new Map<string, string>()
  const contactTypes = typeDocs.map((d) => {
    const key = String(d.key ?? '').trim().toLowerCase()
    const label = String(d.label ?? '').trim() || key
    if (key) labelByKey.set(key, label)
    return {
      key,
      label,
      sortOrder: Number(d.sortOrder ?? 0)
    }
  })

  return { contactTypes, labelByKey }
}

export async function loadContactsListPage(
  models: Pick<ReturnType<typeof getTenantClientModels>, 'Contact' | 'ContactType'>,
  auth: unknown,
  query: ContactListQuery
) {
  const { Contact } = models
  const filter = buildContactListMongoFilter(auth, query)

  const pageSize = Math.min(CONTACT_LIST_MAX_PAGE_SIZE, Math.max(1, query.pageSize))
  const skip = (query.page - 1) * pageSize

  const [{ contactTypes, labelByKey }, total, raw] = await Promise.all([
    loadContactTypeOptions(models.ContactType),
    Contact.countDocuments(filter).maxTimeMS(CONTACT_LIST_QUERY_MAX_TIME_MS),
    Contact.find(filter)
      .select(CONTACT_LIST_SELECT)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .maxTimeMS(CONTACT_LIST_QUERY_MAX_TIME_MS)
      .lean<ContactDoc[]>()
  ])

  const contacts = raw.map((c) => mapContactDocToListRow(c, labelByKey))
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  return {
    contacts,
    contactTypes,
    total,
    page: query.page,
    pageSize,
    totalPages,
    truncated: false
  }
}
