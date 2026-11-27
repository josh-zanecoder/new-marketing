import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import {
  FILL_IF_EMPTY_FIELDS,
  LOAN_STATUS_FIELDS,
  isBlankText,
  newestLoanStatusDoc,
  pickStableKeeper,
  type InboundContactExisting
} from './collapseInboundContactsByEmail'

export type DuplicateMergePlan = {
  keepId: string
  retireIds: string[]
  /** Fields to write on the survivor (empty when nothing needs to move over). */
  set: Record<string, unknown>
}

type BulkWriteOp = {
  updateOne: {
    filter: Record<string, unknown>
    update: { $set: Record<string, unknown> }
  }
}

export type DuplicateMergeContactCollection = {
  aggregate(pipeline: Record<string, unknown>[]): PromiseLike<Array<{ _id: string; ids: unknown[] }>>
  find(filter: Record<string, unknown>): {
    select(fields: string): {
      lean(): Promise<InboundContactExisting[]>
    }
  }
  bulkWrite(ops: BulkWriteOp[], options?: { ordered?: boolean }): Promise<unknown>
}

/**
 * Merge the active contacts that share one email into the oldest one:
 * - the oldest contact survives (same rule as the inbound collapse);
 * - the newest LendingQB loan status among the copies moves onto the survivor;
 * - unsubscribe is sticky (any copy unsubscribed => the survivor is unsubscribed);
 * - blank name/phone/company on the survivor are filled from a copy that has them.
 * Returns null when there is nothing to merge.
 */
export function planDuplicateMerge(docs: InboundContactExisting[]): DuplicateMergePlan | null {
  if (docs.length < 2) return null
  const keeper = docs.reduce((best, doc) => pickStableKeeper(best, doc))
  const others = docs.filter((doc) => doc !== keeper)
  const set: Record<string, unknown> = {}

  if (keeper.isUnsubscribe !== true && docs.some((doc) => doc.isUnsubscribe === true)) {
    set.isUnsubscribe = true
  }

  const best = newestLoanStatusDoc(docs)
  if (best && best !== keeper) {
    for (const field of LOAN_STATUS_FIELDS) set[field] = best[field]
  }

  for (const field of FILL_IF_EMPTY_FIELDS) {
    if (!isBlankText(keeper[field])) continue
    const donor = others.find((doc) => !isBlankText(doc[field]))
    if (donor) set[field] = donor[field]
  }

  return {
    keepId: String(keeper._id),
    retireIds: others.map((doc) => String(doc._id)),
    set
  }
}

const MERGE_SELECT =
  '_id email externalId createdAt updatedAt isUnsubscribe firstName lastName phone company loanStatus loanStatusKey loanStatusUpdatedAt'

const FIND_CHUNK = 500
const WRITE_CHUNK = 1000

/**
 * One sweep over a tenant: find emails that still have more than one active contact and merge each
 * group. Safe to repeat (a clean tenant is a single cheap aggregate) and safe to run on several
 * instances at once (every write is an idempotent update).
 *
 * `hasMore` is true when the group limit was hit, so the caller should sweep again soon.
 */
export async function mergeDuplicateContactsByEmail(params: {
  Contact: DuplicateMergeContactCollection
  source: string
  maxGroups?: number
  now?: Date
}): Promise<{ groups: number; keptIds: string[]; retiredIds: string[]; hasMore: boolean }> {
  const maxGroups = Math.max(1, Math.floor(params.maxGroups ?? 500))
  const deletedAt = params.now ?? new Date()

  const found = await params.Contact.aggregate([
    {
      $match: {
        source: params.source,
        deletedAt: null,
        email: { $type: 'string', $ne: '' }
      }
    },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$email' } } },
        ids: { $push: '$_id' },
        n: { $sum: 1 }
      }
    },
    { $match: { n: { $gt: 1 } } },
    { $limit: maxGroups + 1 }
  ])

  const hasMore = found.length > maxGroups
  const groups = found.slice(0, maxGroups)
  if (!groups.length) return { groups: 0, keptIds: [], retiredIds: [], hasMore: false }

  const keptIds: string[] = []
  const retiredIds: string[] = []
  const ops: BulkWriteOp[] = []

  for (let start = 0; start < groups.length; start += FIND_CHUNK) {
    const chunk = groups.slice(start, start + FIND_CHUNK)
    const docs = await params.Contact.find({
      _id: { $in: chunk.flatMap((group) => group.ids) },
      source: params.source,
      deletedAt: null
    })
      .select(MERGE_SELECT)
      .lean()

    const byEmail = new Map<string, InboundContactExisting[]>()
    for (const doc of docs) {
      const email = normalizeMarketingEmail(doc.email)
      if (!email) continue
      const list = byEmail.get(email)
      if (list) list.push(doc)
      else byEmail.set(email, [doc])
    }

    for (const group of chunk) {
      const plan = planDuplicateMerge(byEmail.get(group._id) ?? [])
      if (!plan) continue
      if (Object.keys(plan.set).length) {
        ops.push({ updateOne: { filter: { _id: plan.keepId }, update: { $set: plan.set } } })
      }
      for (const id of plan.retireIds) {
        ops.push({ updateOne: { filter: { _id: id }, update: { $set: { deletedAt } } } })
        retiredIds.push(id)
      }
      keptIds.push(plan.keepId)
    }
  }

  for (let start = 0; start < ops.length; start += WRITE_CHUNK) {
    await params.Contact.bulkWrite(ops.slice(start, start + WRITE_CHUNK), { ordered: false })
  }

  return { groups: keptIds.length, keptIds, retiredIds, hasMore }
}
