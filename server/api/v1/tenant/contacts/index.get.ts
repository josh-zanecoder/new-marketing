import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { mergeContactOwnerScopeFilter } from '@server/utils/contactOwnerFilter'

type ContactDoc = {
  _id: unknown
  externalId?: string
  source?: string
  contactKind?: string
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

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)

  const auth = event.context.auth as unknown
  const scope =
    isTenantApiKeyAuthContext(auth) && auth.contactOwnerScope?.length
      ? auth.contactOwnerScope
      : undefined

  const filter = mergeContactOwnerScopeFilter({ deletedAt: null }, scope)

  const [total, raw] = await Promise.all([
    Contact.countDocuments(filter),
    Contact.find(filter)
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
  ])

  const rows = raw as ContactDoc[]
  const contacts = rows.map((c) => {
    const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {}
    const ownerRaw = meta && typeof meta.ownerEmail === 'string' ? meta.ownerEmail : ''
    const { firstName, lastName } = contactFirstLastFromDoc(c)
    return {
    id: String(c._id),
    externalId: c.externalId ?? '',
    source: c.source ?? '',
    contactKind: c.contactKind ?? '',
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
    total,
    truncated: total > contacts.length
  }
})
