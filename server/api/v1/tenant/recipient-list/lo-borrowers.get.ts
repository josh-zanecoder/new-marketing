import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  isRegisteredTenantAuthContext,
  isTenantApiKeyAuthContext
} from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import { contactFirstLastFromDoc, formatContactFullName } from '@server/utils/contactPersonName'
import { audienceBaseQuery } from '@server/utils/contact/contactTypeWrite'
import { marketingAudienceOwnerEmailsFromAuth } from '@server/utils/auth/marketingAudienceFromAuth'

/**
 * Preview borrowers owned by a selected LO.
 * Only when superadmin `allowTenantLoRecipientLists` is ON.
 * Owner-scoped sessions may only query owners inside their contact scope.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantLoRecipientLists: 1 } }
  )
  if (!parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)) {
    throw createError({
      statusCode: 403,
      message: 'LO recipient lists are disabled for this tenant'
    })
  }

  const ownerEmail = String(getQuery(event).ownerEmail ?? '')
    .trim()
    .toLowerCase()
  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw createError({ statusCode: 400, message: 'ownerEmail is required' })
  }

  // Flag already verified above — enable LO/OM audience rules for this request.
  const authForAudience = isTenantApiKeyAuthContext(auth)
    ? { ...auth, allowTenantLoRecipientLists: true as const }
    : auth
  const allowedOwners = marketingAudienceOwnerEmailsFromAuth(authForAudience)
  if (allowedOwners && !allowedOwners.includes(ownerEmail)) {
    throw createError({
      statusCode: 403,
      message: 'Loan officer is outside your contact scope'
    })
  }

  const q = getQuery(event)
  const limitRaw = Number(q.limit)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 50
  const emailFilter = String(q.email ?? '')
    .trim()
    .toLowerCase()
  const searchQ = String(q.q ?? '')
    .trim()
    .slice(0, 120)

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const filter: Record<string, unknown> = {
    ...audienceBaseQuery('borrower'),
    deletedAt: null,
    'metadata.ownerEmail': {
      $regex: `^${escapeRe(ownerEmail)}$`,
      $options: 'i'
    }
  }
  if (emailFilter) {
    if (!emailFilter.includes('@')) {
      throw createError({ statusCode: 400, message: 'email must be a valid address' })
    }
    filter.email = {
      $regex: `^${escapeRe(emailFilter)}$`,
      $options: 'i'
    }
  } else if (searchQ.length >= 2) {
    const rx = escapeRe(searchQ)
    filter.$or = [
      { email: { $regex: rx, $options: 'i' } },
      { firstName: { $regex: rx, $options: 'i' } },
      { lastName: { $regex: rx, $options: 'i' } },
      { name: { $regex: rx, $options: 'i' } }
    ]
  }

  const [total, rows] = await Promise.all([
    Contact.countDocuments(filter),
    Contact.find(filter)
      .select({ firstName: 1, lastName: 1, name: 1, email: 1 })
      .sort({ updatedAt: -1 })
      .limit(emailFilter ? 1 : limit)
      .lean()
      .exec()
  ])

  const borrowers = rows.map((doc) => {
    const { firstName, lastName } = contactFirstLastFromDoc(doc as Record<string, unknown>)
    return {
      id: String((doc as { _id: unknown })._id),
      name: formatContactFullName(firstName, lastName) || '—',
      email: typeof (doc as { email?: string }).email === 'string' ? (doc as { email: string }).email : ''
    }
  })

  return { total, borrowers }
})
