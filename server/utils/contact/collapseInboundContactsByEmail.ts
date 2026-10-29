import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'

export type InboundContactExisting = {
  _id: unknown
  email?: string | null
  externalId?: string | null
  updatedAt?: Date | string | null
  isUnsubscribe?: boolean
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

function updatedAtMillis(value: Date | string | null | undefined): number {
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

function preferExisting(a: InboundContactExisting, b: InboundContactExisting): InboundContactExisting {
  const ta = updatedAtMillis(a.updatedAt)
  const tb = updatedAtMillis(b.updatedAt)
  if (ta !== tb) return ta >= tb ? a : b
  return idString(a._id) >= idString(b._id) ? a : b
}

/** Last payload for an email wins. Empty emails are dropped. */
export function dedupeInboundWriteRows(rows: InboundContactWriteRow[]): InboundContactWriteRow[] {
  const order: string[] = []
  const byEmail = new Map<string, InboundContactWriteRow>()
  for (const row of rows) {
    const email = normalizeMarketingEmail(row.email)
    const externalId = String(row.externalId ?? '').trim()
    if (!email || !externalId) continue
    if (!byEmail.has(email)) order.push(email)
    byEmail.set(email, { ...row, email, externalId })
  }
  return order.map((email) => byEmail.get(email)!)
}

/**
 * Same email is one marketing contact. A later borrower id for that email updates
 * the newest row and retires the other copies instead of inserting another.
 */
export function planInboundContactCollapse(params: {
  rows: InboundContactWriteRow[]
  existing: InboundContactExisting[]
}): InboundCollapsePlan[] {
  const incoming = dedupeInboundWriteRows(params.rows)
  const claimed = new Set<string>()
  const plans: InboundCollapsePlan[] = []

  for (const row of incoming) {
    const matches = params.existing.filter((doc) => {
      const id = idString(doc._id)
      if (!id || claimed.has(id)) return false
      const sameEmail = normalizeMarketingEmail(doc.email) === row.email
      const sameExternalId = String(doc.externalId ?? '').trim() === row.externalId
      return sameEmail || sameExternalId
    })

    const keeper = matches.reduce<InboundContactExisting | null>(
      (best, doc) => (best ? preferExisting(best, doc) : doc),
      null
    )
    const keepId = keeper ? idString(keeper._id) : null
    const retireIds = matches
      .map((doc) => idString(doc._id))
      .filter((id) => id && id !== keepId)

    for (const id of [keepId, ...retireIds]) {
      if (id) claimed.add(id)
    }

    const setDoc = { ...row.setDoc, email: row.email, externalId: row.externalId }
    if (matches.some((doc) => doc.isUnsubscribe === true)) {
      setDoc.isUnsubscribe = true
    }

    plans.push({
      email: row.email,
      externalId: row.externalId,
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
    for (const retireId of plan.retireIds) {
      ops.push({
        updateOne: {
          filter: { _id: retireId },
          update: { $set: { deletedAt: params.deletedAt } }
        }
      })
    }
  }
  return ops
}

export async function collapseInboundContactsByEmail(params: {
  Contact: InboundContactCollection
  source: string
  rows: InboundContactWriteRow[]
  now?: Date
}): Promise<{ keptIds: string[]; retiredIds: string[] }> {
  const incoming = dedupeInboundWriteRows(params.rows)
  if (!incoming.length) return { keptIds: [], retiredIds: [] }

  const emails = incoming.map((row) => row.email)
  const externalIds = incoming.map((row) => row.externalId)
  const existing = await params.Contact.find({
    source: params.source,
    deletedAt: null,
    $or: [{ email: { $in: emails } }, { externalId: { $in: externalIds } }]
  })
    .select('_id email externalId updatedAt isUnsubscribe')
    .lean()

  const plans = planInboundContactCollapse({ rows: incoming, existing })
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
    .select('_id email updatedAt')
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
      (best, doc) => (best ? preferExisting(best, doc) : doc),
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
