import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  isRegisteredTenantAuthContext,
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth,
  recipientListOwnershipFromAuth
} from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

const MAX_EMAILS = 2000

function normalizeEmails(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of raw) {
    const email = String(value || '').trim().toLowerCase()
    if (!email.includes('@') || seen.has(email)) continue
    seen.add(email)
    out.push(email)
    if (out.length >= MAX_EMAILS) break
  }
  return out
}

/**
 * Static recipient list from explicit contact emails (tracking save).
 * Members are inserted directly. Dynamic rebuild is not used — empty filters would match the whole audience.
 */
export async function createStaticRecipientListFromEmails(params: {
  tenantConn: Connection
  auth: unknown
  name: string
  emails: string[]
}): Promise<{ id: string; name: string; memberCount: number; unmatchedEmailCount: number }> {
  if (!isRegisteredTenantAuthContext(params.auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }
  const name = params.name.trim().slice(0, 200)
  if (!name) throw createError({ statusCode: 400, message: 'Name is required' })

  const emails = normalizeEmails(params.emails)
  if (!emails.length) {
    throw createError({ statusCode: 400, message: 'No recipient emails in this tracking filter' })
  }

  const { Contact, RecipientList, RecipientListMember } = getTenantClientModels(params.tenantConn)
  const contacts = await Contact.find(
    mergeTenantOwnerEmailScopeFilter({ email: { $in: emails } }, params.auth)
  )
    .select('_id email')
    .lean<{ _id: Types.ObjectId; email?: string }[]>()
    .exec()

  const contactIds = contacts.map((row) => row._id).filter(Boolean)
  if (!contactIds.length) {
    throw createError({
      statusCode: 400,
      message: 'None of these tracking emails match a contact in this workspace'
    })
  }

  const membershipScope = recipientListMembershipScopeFromAuth(params.auth)
  const membershipOwnerEmails =
    membershipScope === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(params.auth)
      : []

  const created = await RecipientList.create({
    name,
    description: 'Saved from Tracking',
    listType: 'static',
    audience: 'contact',
    filters: [],
    filterMode: 'and',
    filterRows: [],
    criterionJoins: [],
    clientId: '',
    membershipScope,
    membershipOwnerEmails,
    ...recipientListOwnershipFromAuth(params.auth)
  })

  const listId = created._id as Types.ObjectId
  await RecipientListMember.insertMany(
    contactIds.map((contactId) => ({ recipientListId: listId, contactId })),
    { ordered: false }
  )

  const matched = new Set(
    contacts.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean)
  )

  return {
    id: String(created._id),
    name,
    memberCount: contactIds.length,
    unmatchedEmailCount: emails.filter((email) => !matched.has(email)).length
  }
}
