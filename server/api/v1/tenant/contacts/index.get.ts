import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { isTenantApiKeyAuthContext } from '../../../../tenant/registry-auth'
import { mergeContactOwnerScopeFilter } from '../../../../utils/contactOwnerFilter'

/** Upper bound for a single response; matches recipient-list scale. */
const CONTACT_LIMIT = 3000

type ContactDoc = {
  _id: unknown
  externalId?: string
  source?: string
  contactKind?: string
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
      .limit(CONTACT_LIMIT)
      .lean()
      .exec()
  ])

  const rows = raw as ContactDoc[]
  const contacts = rows.map((c) => {
    const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : {}
    const ownerRaw = meta && typeof meta.ownerEmail === 'string' ? meta.ownerEmail : ''
    return {
    id: String(c._id),
    externalId: c.externalId ?? '',
    source: c.source ?? '',
    contactKind: c.contactKind ?? '',
    name: c.name ?? '',
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
    truncated: total > CONTACT_LIMIT
  }
})
