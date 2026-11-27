/** Settings for the duplicate-contact merge sweep (one contact per email). */

/**
 * The sweep is a safety net. After a clean pass each tenant is locked by a unique index and then
 * skipped, so later ticks cost almost nothing.
 */
export const CONTACT_DUPLICATE_MERGE_DEFAULT_INTERVAL_MS = 60 * 60 * 1000

/** Floor so a misconfigured env cannot hammer Mongo. */
export const CONTACT_DUPLICATE_MERGE_MIN_INTERVAL_MS = 5 * 60 * 1000

/** Max duplicate-email groups merged per tenant per pass; the rest follow on the next pass. */
export const CONTACT_DUPLICATE_MERGE_MAX_GROUPS = 500

/** Delay before another pass when a tenant still had duplicates left. */
export const CONTACT_DUPLICATE_MERGE_FOLLOW_UP_MS = 60 * 1000

/** Pause between tenants so HTTP/Kafka handlers can check out pool sockets. */
export const CONTACT_DUPLICATE_MERGE_TENANT_YIELD_MS = 75

export function resolveContactDuplicateMergeIntervalMs(rawEnv: string | undefined): number {
  const raw = Number(rawEnv)
  if (!Number.isFinite(raw) || raw <= 0) return CONTACT_DUPLICATE_MERGE_DEFAULT_INTERVAL_MS
  return Math.max(CONTACT_DUPLICATE_MERGE_MIN_INTERVAL_MS, Math.floor(raw))
}
