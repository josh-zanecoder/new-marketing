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
