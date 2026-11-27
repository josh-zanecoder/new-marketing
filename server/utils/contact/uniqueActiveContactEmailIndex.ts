export const UNIQUE_ACTIVE_CONTACT_EMAIL_INDEX = 'uniq_active_crm_kafka_email'

type IndexCollection = {
  createIndex(
    key: Record<string, 1 | -1>,
    options: Record<string, unknown>
  ): Promise<unknown>
}

/**
 * Database guard behind the email merge: at most ONE active (not soft-deleted) contact per email
 * for the synced source. Soft-deleted copies and contacts from other sources are not affected.
 *
 * This is not declared on the schema on purpose: building it while duplicates still exist fails,
 * so it is created only after a sweep left the tenant clean (see `ensureUniqueActiveContactEmailIndex`).
 * `$type: 'null'` is used because partial indexes do not accept `deletedAt: null`.
 */
export function uniqueActiveContactEmailIndexOptions(source: string): Record<string, unknown> {
  return {
    name: UNIQUE_ACTIVE_CONTACT_EMAIL_INDEX,
    unique: true,
    partialFilterExpression: { source, deletedAt: { $type: 'null' } }
  }
}

/**
 * Create the guard index. Never throws: if duplicates appeared again the build fails, which is
 * logged, and the next sweep merges them and retries.
 */
export async function ensureUniqueActiveContactEmailIndex(
  collection: IndexCollection,
  source: string
): Promise<boolean> {
  try {
    await collection.createIndex({ email: 1 }, uniqueActiveContactEmailIndexOptions(source))
    return true
  } catch (err) {
    console.warn('[ContactDuplicateMerge] could not create the unique active-email index yet', {
      error: err instanceof Error ? err.message : String(err)
    })
    return false
  }
}
