import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'

/** Contacts eligible for recipient lists and campaign sends (not deleted, not unsubscribed). */
export const MARKETABLE_CONTACT_BASE = {
  deletedAt: null,
  isUnsubscribe: { $ne: true as const }
} as const

export function withMarketableContactFilter<T extends Record<string, unknown>>(
  query: T
): T & typeof MARKETABLE_CONTACT_BASE {
  return { ...query, ...MARKETABLE_CONTACT_BASE }
}

/**
 * Normalized emails that have a non-deleted unsubscribed contact.
 * Used at send time because audience loaders exclude unsubscribed rows via
 * {@link withMarketableContactFilter}.
 */
export async function findUnsubscribedNormalizedEmails(
  Contact: ContactModel,
  emails: string[]
): Promise<Set<string>> {
  const normalized = [
    ...new Set(emails.map((e) => normalizeMarketingEmail(e)).filter(Boolean))
  ]
  if (!normalized.length) return new Set()

  const docs = await Contact.find({
    email: { $in: normalized },
    isUnsubscribe: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  })
    .select({ email: 1 })
    .lean<Pick<ContactLean, 'email'>[]>()

  const out = new Set<string>()
  for (const doc of docs) {
    const key = normalizeMarketingEmail(doc.email)
    if (key) out.add(key)
  }
  return out
}
