import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { onContactUnsubscribed } from '@server/utils/contact/contactSubscriptionEffects'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const BULK_UNSUBSCRIBE_MAX_EMAILS = 10_000

export type BulkUnsubscribeByEmailResult = {
  totalSubmitted: number
  uniqueEmails: number
  updated: number
  alreadyUnsubscribed: number
  notFound: number
  invalid: string[]
}

export function normalizeBulkUnsubscribeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const email = String(raw).trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

/**
 * Find non-deleted contacts by email and set `isUnsubscribe: true`.
 * Runs the same list side effects as the tenant subscription toggle.
 */
export async function bulkUnsubscribeContactsByEmail(
  tenantConn: Connection,
  emailsInput: unknown[]
): Promise<BulkUnsubscribeByEmailResult> {
  const invalid: string[] = []
  const unique = new Set<string>()

  for (const raw of emailsInput) {
    const normalized = normalizeBulkUnsubscribeEmail(raw)
    if (!normalized) {
      const shown = String(raw ?? '').trim()
      if (shown) invalid.push(shown.slice(0, 200))
      continue
    }
    unique.add(normalized)
  }

  const emails = [...unique].slice(0, BULK_UNSUBSCRIBE_MAX_EMAILS)
  const { Contact } = getTenantClientModels(tenantConn)

  const contacts = (await Contact.find({
    email: { $in: emails },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  })
    .select({ _id: 1, email: 1, isUnsubscribe: 1 })
    .lean()
    .exec()) as Array<{
    _id: Types.ObjectId
    email?: string
    isUnsubscribe?: boolean
  }>

  const foundEmails = new Set<string>()
  let updated = 0
  let alreadyUnsubscribed = 0

  for (const contact of contacts) {
    const email = String(contact.email || '').trim().toLowerCase()
    if (email) foundEmails.add(email)

    if (contact.isUnsubscribe === true) {
      alreadyUnsubscribed += 1
      continue
    }

    await Contact.updateOne({ _id: contact._id }, { $set: { isUnsubscribe: true } })
    await onContactUnsubscribed(tenantConn, contact._id)
    updated += 1
  }

  return {
    totalSubmitted: emailsInput.length,
    uniqueEmails: emails.length,
    updated,
    alreadyUnsubscribed,
    notFound: emails.filter((email) => !foundEmails.has(email)).length,
    invalid: [...new Set(invalid)].slice(0, 50)
  }
}
