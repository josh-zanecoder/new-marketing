import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

type ContactDoc = {
  _id: unknown
  externalId?: string
  source?: string
  contactKind?: string
  contactType?: string[]
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  company?: string
  channel?: string
  metadata?: Record<string, unknown>
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

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Contact, ContactType } = getTenantClientModels(conn)

  const auth = event.context.auth as unknown
  const filter = mergeTenantOwnerEmailScopeFilter({ deletedAt: null }, auth)

  const [total, raw, typeDocs] = await Promise.all([
    Contact.countDocuments(filter),
    Contact.find(filter)
      .sort({ updatedAt: -1 })
      .lean()
      .exec(),
    ContactType.find({ enabled: { $ne: false } })
      .sort({ sortOrder: 1, key: 1 })
      .lean()
      .exec()
  ])

  const labelByKey = new Map<string, string>()
  const contactTypes = (typeDocs as ContactTypeLean[]).map((d) => {
    const key = String(d.key ?? '').trim().toLowerCase()
    const label = String(d.label ?? '').trim() || key
    if (key) labelByKey.set(key, label)
    return {
      key,
      label,
      sortOrder: Number(d.sortOrder ?? 0)
    }
  })

  const rows = raw as ContactDoc[]
  const contacts = rows.map((c) => {
    const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {}
    const ownerRaw = meta && typeof meta.ownerEmail === 'string' ? meta.ownerEmail : ''
    const { firstName, lastName } = contactFirstLastFromDoc(c)
    const typeKeys = effectiveContactTypeKeys(c)
    const primaryKey = typeKeys[0] || ''
    return {
    id: String(c._id),
    externalId: c.externalId ?? '',
    source: c.source ?? '',
    /** Same keys as tenant `contact_types` (may be empty on very old rows). */
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
    createdAt: c.createdAt?.toISOString?.() ?? null,
    updatedAt: c.updatedAt?.toISOString?.() ?? null
  }
  })

  return {
    contacts,
    contactTypes,
    total,
    truncated: total > contacts.length
  }
})
