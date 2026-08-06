import type { Model } from 'mongoose'
import {
  BREVO_SOURCE_DEDUP_TOLERANCE_MS,
  areBrevoTrackingInstantsSame,
  brevoTrackingIdentityFromDate,
  clusterBrevoEventTimestamps,
  parseBrevoEventAtMs,
  preferRicherBrevoEventAtMs
} from '@server/utils/tracking/brevoTrackingEventIdentity'

export type LeanTrackingRow = {
  _id: unknown
  email?: string
  date?: string
  messageId?: string
  event?: string
  tag?: string
  subject?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
  eventAt?: Date | null
  eventKeyAt?: number | null
  campaignId?: string
  userEmail?: string
}

function eventTimeMs(doc: LeanTrackingRow): number | null {
  if (typeof doc.eventKeyAt === 'number' && Number.isFinite(doc.eventKeyAt)) {
    return doc.eventKeyAt
  }
  if (doc.eventAt instanceof Date && Number.isFinite(doc.eventAt.getTime())) {
    return doc.eventAt.getTime()
  }
  return parseBrevoEventAtMs(doc.date)
}

function scoreDoc(doc: LeanTrackingRow): number {
  let score = 0
  if ((doc.from || '').trim()) score += 4
  if ((doc.tag || '').trim()) score += 2
  if ((doc.subject || '').trim()) score += 1
  if ((doc.email || '').trim()) score += 1
  if ((doc.ip || '').trim()) score += 1
  const t = eventTimeMs(doc)
  if (t != null && t % 1000 !== 0) score += 2 // prefer sub-second (webhook) timestamps
  return score
}

function mergeDocs(docs: LeanTrackingRow[]): Record<string, unknown> {
  const sorted = [...docs].sort((a, b) => scoreDoc(b) - scoreDoc(a))
  const pick = (key: keyof LeanTrackingRow): string => {
    for (const d of sorted) {
      const v = String(d[key] ?? '').trim()
      if (v) return v
    }
    return ''
  }

  let bestMs: number | null = null
  for (const d of docs) {
    bestMs = preferRicherBrevoEventAtMs(bestMs, eventTimeMs(d))
  }
  const identity =
    bestMs != null
      ? {
          date: new Date(bestMs).toISOString(),
          eventAt: new Date(bestMs),
          eventKeyAt: bestMs
        }
      : brevoTrackingIdentityFromDate(pick('date'))

  return {
    email: pick('email'),
    date: identity.date,
    messageId: pick('messageId'),
    event: pick('event'),
    tag: pick('tag'),
    subject: pick('subject'),
    from: pick('from'),
    ip: pick('ip'),
    link: pick('link'),
    reason: pick('reason'),
    eventAt: identity.eventAt,
    eventKeyAt: identity.eventKeyAt,
    campaignId: pick('campaignId'),
    userEmail: pick('userEmail').toLowerCase()
  }
}

async function backfillEventKeyAt(
  BrevoTrackingEvent: Model<unknown>,
  scope: Record<string, unknown>
): Promise<number> {
  const missing = (await BrevoTrackingEvent.find({
    ...scope,
    $or: [{ eventKeyAt: null }, { eventKeyAt: { $exists: false } }]
  })
    .select({ _id: 1, date: 1, eventAt: 1 })
    .lean()
    .exec()) as Array<{ _id: unknown; date?: string; eventAt?: Date | null }>

  let backfilled = 0
  for (const row of missing) {
    const fromDate = parseBrevoEventAtMs(row.date)
    const fromEventAt =
      row.eventAt instanceof Date && Number.isFinite(row.eventAt.getTime())
        ? row.eventAt.getTime()
        : null
    const eventKeyAt = fromDate ?? fromEventAt
    if (eventKeyAt == null) continue
    await BrevoTrackingEvent.updateOne(
      { _id: row._id },
      {
        $set: {
          eventKeyAt,
          date: new Date(eventKeyAt).toISOString(),
          eventAt: new Date(eventKeyAt)
        }
      }
    )
    backfilled += 1
  }
  return backfilled
}

/**
 * Collapse webhook/API copies of the same event (same messageId + event + ~same instant).
 * Does not merge real retries that are > tolerance apart.
 */
export async function dedupeBrevoTrackingEvents(
  BrevoTrackingEvent: Model<unknown>,
  options: { campaignId?: string | null } = {}
): Promise<{ backfilled: number; removed: number; groups: number }> {
  const campaignId = options.campaignId?.trim() || null
  const scope = campaignId ? { campaignId } : {}

  const backfilled = await backfillEventKeyAt(BrevoTrackingEvent, scope)

  const pairs = (await BrevoTrackingEvent.aggregate([
    { $match: scope },
    {
      $group: {
        _id: { messageId: '$messageId', event: '$event' },
        n: { $sum: 1 }
      }
    },
    { $match: { n: { $gt: 1 } } }
  ]).exec()) as Array<{ _id: { messageId: string; event: string }; n: number }>

  let removed = 0
  let groups = 0

  for (const pair of pairs) {
    const messageId = pair._id.messageId
    const event = pair._id.event
    if (!messageId || !event) continue

    const docs = (await BrevoTrackingEvent.find({ ...scope, messageId, event })
      .lean()
      .exec()) as LeanTrackingRow[]
    if (docs.length < 2) continue

    const timed = docs
      .map((d) => ({ doc: d, t: eventTimeMs(d) }))
      .filter((x): x is { doc: LeanTrackingRow; t: number } => x.t != null)

    const clusters = clusterBrevoEventTimestamps(
      timed.map((x) => ({ id: String(x.doc._id), t: x.t })),
      BREVO_SOURCE_DEDUP_TOLERANCE_MS
    )

    const byId = new Map(timed.map((x) => [String(x.doc._id), x.doc]))

    for (const ids of clusters) {
      if (ids.length < 2) continue
      groups += 1
      const clusterDocs = ids.map((id) => byId.get(id)!).filter(Boolean)
      if (clusterDocs.length < 2) continue

      // Sanity: only merge if every pair is within tolerance of the cluster anchor.
      const times = clusterDocs.map((d) => eventTimeMs(d)!)
      const minT = Math.min(...times)
      const maxT = Math.max(...times)
      if (maxT - minT > BREVO_SOURCE_DEDUP_TOLERANCE_MS) continue
      if (!areBrevoTrackingInstantsSame(minT, maxT)) continue

      const merged = mergeDocs(clusterDocs)
      const keep = [...clusterDocs].sort((a, b) => scoreDoc(b) - scoreDoc(a))[0]!
      const dropIds = clusterDocs
        .filter((d) => String(d._id) !== String(keep._id))
        .map((d) => d._id)

      await BrevoTrackingEvent.updateOne({ _id: keep._id }, { $set: merged })
      if (dropIds.length) {
        const del = await BrevoTrackingEvent.deleteMany({ _id: { $in: dropIds } })
        removed += del.deletedCount ?? 0
      }
    }
  }

  return { backfilled, removed, groups }
}

/** Find an existing row that is a source-duplicate of this identity. */
export async function findProximityTrackingEvent(
  BrevoTrackingEvent: Model<unknown>,
  params: { messageId: string; event: string; eventKeyAt: number }
): Promise<LeanTrackingRow | null> {
  const { messageId, event, eventKeyAt } = params
  const tol = BREVO_SOURCE_DEDUP_TOLERANCE_MS
  const row = (await BrevoTrackingEvent.findOne({
    messageId,
    event,
    $or: [
      { eventKeyAt: { $gte: eventKeyAt - tol, $lte: eventKeyAt + tol } },
      {
        eventAt: {
          $gte: new Date(eventKeyAt - tol),
          $lte: new Date(eventKeyAt + tol)
        }
      }
    ]
  })
    .lean()
    .exec()) as LeanTrackingRow | null
  return row
}
