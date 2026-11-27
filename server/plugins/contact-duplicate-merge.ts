import {
  CONTACT_DUPLICATE_MERGE_FOLLOW_UP_MS,
  resolveContactDuplicateMergeIntervalMs
} from '../constants/contactDuplicateMerge'

/**
 * Duplicate-contact safety net (Mongo only — not Kafka).
 * Several retail borrower records can share one email; the inbound handler keeps a single
 * contact per email, and this sweep merges any leftovers (legacy data, races) into the oldest
 * contact and then locks each tenant with a unique active-email index.
 *
 * Part of the LendingQB integration: only tenants with the LendingQB permission ON are swept
 * (see `sweepDuplicateContactsForDb`); other tenants keep the original behavior.
 */
export default defineNitroPlugin(() => {
  if (process.env.CONTACT_DUPLICATE_MERGE_DISABLED === 'true') return

  const intervalMs = resolveContactDuplicateMergeIntervalMs(
    process.env.CONTACT_DUPLICATE_MERGE_INTERVAL_MS
  )

  let busy = false
  function tick() {
    if (busy) return
    busy = true
    import('../services/mergeDuplicateContacts')
      .then(({ sweepDuplicateContacts }) => sweepDuplicateContacts())
      .then((needsAnotherPass) => {
        if (needsAnotherPass) setTimeout(tick, CONTACT_DUPLICATE_MERGE_FOLLOW_UP_MS)
      })
      .catch((e) => console.error('[ContactDuplicateMerge] tick failed', e))
      .finally(() => {
        busy = false
      })
  }

  void import('../lib/mongoose')
    .then(({ getRegistryConnection }) => getRegistryConnection())
    .then(() => {
      // Offset from the campaign reconcilers (12s / 20s) so startup ticks do not collide.
      setTimeout(tick, 45_000)
      setInterval(tick, intervalMs)
    })
    .catch((e) => console.error('[ContactDuplicateMerge] startup failed', e))
})
