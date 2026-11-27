import { Types } from 'mongoose'
import {
  CONTACT_DUPLICATE_MERGE_MAX_GROUPS,
  CONTACT_DUPLICATE_MERGE_TENANT_YIELD_MS
} from '../constants/contactDuplicateMerge'
import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { KAFKA_INBOUND_CONTACT_SOURCE } from '../utils/contact/inboundContactSource'
import {
  mergeDuplicateContactsByEmail,
  type DuplicateMergeContactCollection
} from '../utils/contact/mergeDuplicateContactsByEmail'
import { ensureUniqueActiveContactEmailIndex } from '../utils/contact/uniqueActiveContactEmailIndex'
import { isLendingQbStatusEnabledForDb } from '../utils/recipient/lendingQbStatusFeature'
import { syncContactRecipientListMembership } from '../utils/recipient/syncContactRecipientListMembership'

/**
 * Tenants whose unique active-email index exists (per process). Once it exists duplicates cannot
 * be created, so those tenants are skipped instead of scanned: after the first clean pass a tick
 * only touches tenants that still have work or whose index could not be built yet.
 */
const guardedTenantDbNames = new Set<string>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type TenantDuplicateSweepResult = {
  /** Duplicate groups merged in this pass. */
  merged: number
  /** The group limit was hit: this tenant needs another pass soon. */
  hasMore: boolean
}

/**
 * Duplicate-contact safety net for ONE tenant: merge active contacts that share an email into the
 * oldest one, refresh recipient-list membership for what changed, then lock the tenant with the
 * unique active-email index. A problem is logged and skipped.
 *
 * Part of the LendingQB integration: tenants with the LendingQB permission OFF are left alone
 * (their contacts keep the original behavior).
 */
export async function sweepDuplicateContactsForDb(dbName: string): Promise<TenantDuplicateSweepResult> {
  const none: TenantDuplicateSweepResult = { merged: 0, hasMore: false }
  if (guardedTenantDbNames.has(dbName)) return none
  if (!(await isLendingQbStatusEnabledForDb(dbName))) return none

  let tenantConn
  try {
    tenantConn = await getTenantConnectionByDbName(dbName, { verifyWithPing: false })
  } catch {
    return none
  }

  try {
    const { Contact } = getTenantClientModels(tenantConn)
    const result = await mergeDuplicateContactsByEmail({
      Contact: Contact as unknown as DuplicateMergeContactCollection,
      source: KAFKA_INBOUND_CONTACT_SOURCE,
      maxGroups: CONTACT_DUPLICATE_MERGE_MAX_GROUPS
    })

    if (result.groups > 0) {
      console.log('[ContactDuplicateMerge] merged duplicate contacts', {
        dbName,
        groups: result.groups,
        retired: result.retiredIds.length,
        hasMore: result.hasMore
      })
      for (const id of [...result.keptIds, ...result.retiredIds]) {
        if (!Types.ObjectId.isValid(id)) continue
        try {
          await syncContactRecipientListMembership(tenantConn, new Types.ObjectId(id))
        } catch (err) {
          console.warn('[ContactDuplicateMerge] recipient list sync failed', {
            dbName,
            contactId: id,
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }
    }

    if (!result.hasMore && (await Contact.estimatedDocumentCount()) > 0) {
      // Lock the tenant only when it is clean, and never create the collection for an empty one.
      const ok = await ensureUniqueActiveContactEmailIndex(
        Contact.collection as unknown as Parameters<typeof ensureUniqueActiveContactEmailIndex>[0],
        KAFKA_INBOUND_CONTACT_SOURCE
      )
      if (ok) guardedTenantDbNames.add(dbName)
    }
    return { merged: result.groups, hasMore: result.hasMore }
  } catch (err) {
    console.warn('[ContactDuplicateMerge] tenant sweep failed', {
      dbName,
      error: err instanceof Error ? err.message : String(err)
    })
    return none
  }
}

/**
 * One tick of the safety net across every registry tenant (see `sweepDuplicateContactsForDb`).
 *
 * Returns true when some tenant still has duplicates left (group limit hit), so the caller should
 * run another pass soon.
 */
export async function sweepDuplicateContacts(): Promise<boolean> {
  const registry = await getRegistryConnection()
  const rows = await registry.collection('clients').find({}).project({ dbName: 1 }).toArray()
  const dbNames = [
    ...new Set(
      rows
        .map((row) => (typeof row.dbName === 'string' ? row.dbName.trim() : ''))
        .filter(Boolean)
    )
  ]

  let merged = 0
  let needsAnotherPass = false

  for (const dbName of dbNames) {
    const result = await sweepDuplicateContactsForDb(dbName)
    merged += result.merged
    if (result.hasMore) needsAnotherPass = true
    await sleep(CONTACT_DUPLICATE_MERGE_TENANT_YIELD_MS)
  }

  if (merged) {
    console.log('[ContactDuplicateMerge] tick done', { merged, tenantsTotal: dbNames.length })
  }
  return needsAnotherPass
}
