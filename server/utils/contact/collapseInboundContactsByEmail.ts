import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'

export type InboundContactExisting = {
  _id: unknown
  email?: string | null
  externalId?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  isUnsubscribe?: boolean
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  company?: string | null
  /** LendingQB loan status fields (only set when the CRM has synced a loan status). */
  loanStatus?: string | null
  loanStatusKey?: string | null
  loanStatusUpdatedAt?: Date | string | null
}

export type InboundContactWriteRow = {
  email: string
  externalId: string
  setDoc: Record<string, unknown>
}

export type InboundCollapsePlan = {
  email: string
  externalId: string
  setDoc: Record<string, unknown>
  keepId: string | null
  retireIds: string[]
}

type BulkWriteOp = {
  updateOne: {
    filter: Record<string, unknown>
    update: { $set: Record<string, unknown> }
    upsert?: boolean
  }
}

export type InboundContactCollection = {
  find(filter: Record<string, unknown>): {
    select(fields: string): {
      lean(): Promise<InboundContactExisting[]>
    }
  }
  bulkWrite(ops: BulkWriteOp[], options?: { ordered?: boolean }): Promise<unknown>
}

function idString(id: unknown): string {
  return String(id ?? '')
}

function toMillis(value: Date | string | null | undefined): number {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value)
    return Number.isNaN(time) ? 0 : time
  }
  return 0
}

const updatedAtMillis = toMillis

/** Creation time: `createdAt`, else the ObjectId timestamp, else 0 (unknown). */
function createdAtMillis(doc: InboundContactExisting): number {
  const created = toMillis(doc.createdAt)
  if (created > 0) return created
  const id = idString(doc._id)
  if (/^[0-9a-f]{24}$/i.test(id)) return parseInt(id.slice(0, 8), 16) * 1000
  return 0
}

/**
 * The stable survivor for one email: the OLDEST contact (ties: lowest id).
 * It keeps its id, owner and `externalId`, so recipient-list membership, campaign history and
 * unsubscribe state do not shift when more borrower records arrive for the same email.
 */
export function pickStableKeeper(
  a: InboundContactExisting,
  b: InboundContactExisting
): InboundContactExisting {
  const ta = createdAtMillis(a)
  const tb = createdAtMillis(b)
  if (ta !== tb) return ta < tb ? a : b
  return idString(a._id) <= idString(b._id) ? a : b
}

export const LOAN_STATUS_FIELDS = ['loanStatus', 'loanStatusKey', 'loanStatusUpdatedAt'] as const

/** Contact fields a secondary borrower record may fill in, but only when the survivor has none. */
export const FILL_IF_EMPTY_FIELDS = ['firstName', 'lastName', 'phone', 'company'] as const

export function isBlankText(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === ''
}

function hasLoanStatus(doc: InboundContactExisting): boolean {
  return typeof doc.loanStatusKey === 'string' && doc.loanStatusKey.length > 0
}

/** The stored contact with the newest loan status (undefined when none has one). */
export function newestLoanStatusDoc(
  docs: InboundContactExisting[]
): InboundContactExisting | null {
  return docs.filter(hasLoanStatus).reduce<InboundContactExisting | null>((acc, doc) => {
    if (!acc) return doc
    return updatedAtMillis(doc.loanStatusUpdatedAt) > updatedAtMillis(acc.loanStatusUpdatedAt)
      ? doc
      : acc
  }, null)
}

/**
 * LendingQB loan status policy for one incoming write:
 * - ordinary contact events carry no loan status and must never wipe it;
 * - an incoming loan status only applies when it is not older than what is already stored;
 * - when duplicates of the same email are merged, the newest stored loan status is preserved.
 */
function applyLoanStatusPolicy(
  setDoc: Record<string, unknown>,
  keeper: InboundContactExisting | null,
  matches: InboundContactExisting[]
): void {
  const incomingKey = typeof setDoc.loanStatusKey === 'string' ? setDoc.loanStatusKey : ''
  const incomingAt = updatedAtMillis(setDoc.loanStatusUpdatedAt as Date | string | null | undefined)

  const best = newestLoanStatusDoc(matches)

  if (incomingKey) {
    if (best && updatedAtMillis(best.loanStatusUpdatedAt) > incomingAt) {
      for (const field of LOAN_STATUS_FIELDS) setDoc[field] = best[field]
    }
    return
  }

  // Nothing incoming: only copy over when the surviving doc would otherwise lose the status.
  if (best && best !== keeper) {
    for (const field of LOAN_STATUS_FIELDS) setDoc[field] = best[field]
  }
}

type IncomingLoanStatus = { key: string; at: number }

function incomingLoanStatus(setDoc: Record<string, unknown>): IncomingLoanStatus | null {
  const key = typeof setDoc.loanStatusKey === 'string' ? setDoc.loanStatusKey : ''
  if (!key) return null
  return {
    key,
    at: updatedAtMillis(setDoc.loanStatusUpdatedAt as Date | string | null | undefined)
  }
}

/** The incoming row carrying the newest loan status (undefined when none carries one). */
function newestIncomingLoanStatusRow(
  rows: InboundContactWriteRow[]
): InboundContactWriteRow | null {
  let best: InboundContactWriteRow | null = null
  let bestAt = -1
  for (const row of rows) {
    const status = incomingLoanStatus(row.setDoc)
    if (!status) continue
    if (!best || status.at > bestAt) {
      best = row
      bestAt = status.at
    }
  }
  return best
}

function copyLoanStatusFields(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const field of LOAN_STATUS_FIELDS) {
    if (source[field] !== undefined) target[field] = source[field]
  }
}

type IncomingGroup = { email: string; rows: InboundContactWriteRow[] }

/**
 * Group incoming rows by email, keeping the arrival order. Several borrower records can share an
 * email (one per broker or application); all of them are kept so the survivor's own record can be
 * told apart from the secondary ones. Empty emails/external ids are dropped.
 */
function groupIncomingRows(rows: InboundContactWriteRow[]): IncomingGroup[] {
  const order: string[] = []
  const byEmail = new Map<string, InboundContactWriteRow[]>()
  for (const row of rows) {
    const email = normalizeMarketingEmail(row.email)
    const externalId = String(row.externalId ?? '').trim()
    if (!email || !externalId) continue
    let group = byEmail.get(email)
    if (!group) {
      group = []
      byEmail.set(email, group)
      order.push(email)
    }
    group.push({ ...row, email, externalId })
  }
  return order.map((email) => ({ email, rows: byEmail.get(email)! }))
}

/**
 * Same email is ONE marketing contact, and it is stable:
 * - the oldest existing contact survives and other copies are retired;
 * - the survivor's own borrower record (matching `externalId`) updates it fully;
 * - a secondary borrower record for the same email (another broker/application) never takes over
 *   `externalId`, owner or contact details; it only fills blanks and can bring a newer loan status.
 */
export function planInboundContactCollapse(params: {
  rows: InboundContactWriteRow[]
  existing: InboundContactExisting[]
}): InboundCollapsePlan[] {
  const groups = groupIncomingRows(params.rows)
  const claimed = new Set<string>()
  const plans: InboundCollapsePlan[] = []

  for (const group of groups) {
    const externalIds = new Set(group.rows.map((row) => row.externalId))
    const matches = params.existing.filter((doc) => {
      const id = idString(doc._id)
      if (!id || claimed.has(id)) return false
      const sameEmail = normalizeMarketingEmail(doc.email) === group.email
      const sameExternalId = externalIds.has(String(doc.externalId ?? '').trim())
      return sameEmail || sameExternalId
    })

    const keeper = matches.reduce<InboundContactExisting | null>(
      (best, doc) => (best ? pickStableKeeper(best, doc) : doc),
      null
    )
    const keepId = keeper ? idString(keeper._id) : null
    const retireIds = matches
      .map((doc) => idString(doc._id))
      .filter((id) => id && id !== keepId)

    for (const id of [keepId, ...retireIds]) {
      if (id) claimed.add(id)
    }

    const keeperExternalId = keeper ? String(keeper.externalId ?? '').trim() : ''
    // New contact (or survivor without an id): the first row of the email owns it.
    // Existing survivor: only a row carrying the survivor's own externalId may overwrite it.
    const primary =
      !keeper || !keeperExternalId
        ? group.rows[0]
        : group.rows.find((row) => row.externalId === keeperExternalId)

    const bestIncoming = newestIncomingLoanStatusRow(group.rows)
    let setDoc: Record<string, unknown>
    let planExternalId: string

    if (primary) {
      setDoc = { ...primary.setDoc, email: group.email, externalId: primary.externalId }
      planExternalId = primary.externalId
      if (bestIncoming && bestIncoming !== primary) {
        const own = incomingLoanStatus(setDoc)
        const other = incomingLoanStatus(bestIncoming.setDoc)
        if (other && (!own || other.at > own.at)) {
          copyLoanStatusFields(setDoc, bestIncoming.setDoc)
        }
      }
    } else {
      // Secondary borrower record(s) only: leave externalId/owner/details of the survivor alone.
      setDoc = { email: group.email }
      planExternalId = keeperExternalId
      for (const field of FILL_IF_EMPTY_FIELDS) {
        if (!keeper || !isBlankText(keeper[field])) continue
        const donor = group.rows.map((row) => row.setDoc[field]).find((v) => !isBlankText(v))
        if (donor !== undefined) setDoc[field] = donor
      }
      if (bestIncoming) copyLoanStatusFields(setDoc, bestIncoming.setDoc)
    }

    if (matches.some((doc) => doc.isUnsubscribe === true)) {
      setDoc.isUnsubscribe = true
    }
    applyLoanStatusPolicy(setDoc, keeper, matches)

    plans.push({
      email: group.email,
      externalId: planExternalId,
      setDoc,
      keepId,
      retireIds
    })
  }

  return plans
}

export function inboundCollapseBulkOps(params: {
  source: string
  plans: InboundCollapsePlan[]
  deletedAt: Date
}): BulkWriteOp[] {
  const ops: BulkWriteOp[] = []
  for (const plan of params.plans) {
    // Retire the other copies BEFORE writing the survivor: when a borrower's email changes to one
    // another copy already holds, the unique active-email index must never see two active copies.
    for (const retireId of plan.retireIds) {
      ops.push({
        updateOne: {
          filter: { _id: retireId },
          update: { $set: { deletedAt: params.deletedAt } }
        }
      })
    }
    if (plan.keepId) {
      ops.push({
        updateOne: {
          filter: { _id: plan.keepId },
          update: { $set: plan.setDoc }
        }
      })
    } else {
      ops.push({
        updateOne: {
          filter: {
            source: params.source,
            email: plan.email,
            deletedAt: null
          },
          update: { $set: plan.setDoc },
          upsert: true
        }
      })
    }
  }
  return ops
}

/** Mongo duplicate-key error (E11000), as thrown by `bulkWrite` / `insert`. */
export function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }
  return e.code === 11000 || (typeof e.message === 'string' && e.message.includes('E11000'))
}

const COLLAPSE_SELECT =
  '_id email externalId createdAt updatedAt isUnsubscribe firstName lastName phone company loanStatus loanStatusKey loanStatusUpdatedAt'

/** One find -> plan -> write pass. Throws on a write error (the caller decides about retrying). */
async function collapseOnce(params: {
  Contact: InboundContactCollection
  source: string
  groups: IncomingGroup[]
  now?: Date
}): Promise<{ keptIds: string[]; retiredIds: string[] }> {
  const rows = params.groups.flatMap((group) => group.rows)
  const emails = params.groups.map((group) => group.email)
  const externalIds = [...new Set(rows.map((row) => row.externalId))]
  const existing = await params.Contact.find({
    source: params.source,
    deletedAt: null,
    $or: [{ email: { $in: emails } }, { externalId: { $in: externalIds } }]
  })
    .select(COLLAPSE_SELECT)
    .lean()

  const plans = planInboundContactCollapse({ rows, existing })
  const deletedAt = params.now ?? new Date()
  const ops = inboundCollapseBulkOps({ source: params.source, plans, deletedAt })
  if (ops.length) {
    await params.Contact.bulkWrite(ops, { ordered: true })
  }

  const retiredIds = plans.flatMap((plan) => plan.retireIds)
  const keptFromPlan = plans.map((plan) => plan.keepId).filter((id): id is string => Boolean(id))
  if (keptFromPlan.length === plans.length) {
    return { keptIds: keptFromPlan, retiredIds }
  }

  const after = await params.Contact.find({
    source: params.source,
    deletedAt: null,
    email: { $in: emails }
  })
    .select('_id email createdAt updatedAt')
    .lean()

  const keptIds: string[] = []
  const seen = new Set<string>()
  for (const plan of plans) {
    if (plan.keepId) {
      keptIds.push(plan.keepId)
      continue
    }
    const matches = after.filter((doc) => normalizeMarketingEmail(doc.email) === plan.email)
    const keeper = matches.reduce<InboundContactExisting | null>(
      (best, doc) => (best ? pickStableKeeper(best, doc) : doc),
      null
    )
    const id = keeper ? idString(keeper._id) : ''
    if (id && !seen.has(id)) {
      seen.add(id)
      keptIds.push(id)
    }
  }

  return { keptIds, retiredIds }
}

export async function collapseInboundContactsByEmail(params: {
  Contact: InboundContactCollection
  source: string
  rows: InboundContactWriteRow[]
  now?: Date
}): Promise<{ keptIds: string[]; retiredIds: string[] }> {
  const groups = groupIncomingRows(params.rows)
  if (!groups.length) return { keptIds: [], retiredIds: [] }

  try {
    return await collapseOnce({ ...params, groups })
  } catch (err) {
    // The unique active-email index (see uniqueActiveContactEmailIndex) can reject an insert when
    // another writer created the same email between our read and write. The pass is idempotent, so
    // re-read and plan again: the competing insert is now the survivor.
    if (!isDuplicateKeyError(err)) throw err
    return collapseOnce({ ...params, groups })
  }
}
