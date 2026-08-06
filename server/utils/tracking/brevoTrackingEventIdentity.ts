/**
 * Stable identity for Brevo tracking rows.
 *
 * Webhooks often send offsets + milliseconds (`…T17:56:28.034-07:00`);
 * the events API often sends truncated UTC (`…T00:56:28.000Z`). Same instant,
 * different strings — exact string/`second` keys either double or over-merge.
 *
 * We store exact millisecond timestamps and treat two rows as the same
 * source-duplicate only when messageId + event match and timestamps fall within
 * SOURCE_DEDUP_TOLERANCE_MS (webhook↔API skew is typically <100ms).
 */

/** Max |Δt| to treat webhook vs API copies as one event (not a real retry). */
export const BREVO_SOURCE_DEDUP_TOLERANCE_MS = 1000

/** Exact UTC ms from a Brevo date string, or null if unparseable. */
export function parseBrevoEventAtMs(dateStr: string | undefined | null): number | null {
  const raw = String(dateStr || '').trim()
  if (!raw) return null
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  return ms
}

/** True when two instants are close enough to be the same Brevo event from two feeds. */
export function areBrevoTrackingInstantsSame(
  aMs: number | null | undefined,
  bMs: number | null | undefined,
  toleranceMs: number = BREVO_SOURCE_DEDUP_TOLERANCE_MS
): boolean {
  if (aMs == null || bMs == null) return false
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return false
  return Math.abs(aMs - bMs) <= toleranceMs
}

/**
 * Prefer the timestamp that still has sub-second precision (webhook),
 * otherwise the later one.
 */
export function preferRicherBrevoEventAtMs(
  aMs: number | null | undefined,
  bMs: number | null | undefined
): number | null {
  if (aMs == null && bMs == null) return null
  if (aMs == null) return bMs ?? null
  if (bMs == null) return aMs
  const aHasSubSecond = aMs % 1000 !== 0
  const bHasSubSecond = bMs % 1000 !== 0
  if (aHasSubSecond && !bHasSubSecond) return aMs
  if (bHasSubSecond && !aHasSubSecond) return bMs
  return Math.max(aMs, bMs)
}

export type BrevoTrackingIdentityFields = {
  date: string
  eventAt: Date | null
  /** Exact UTC ms — used with proximity matching, not second-floor uniqueness. */
  eventKeyAt: number | null
}

export function brevoTrackingIdentityFromDate(
  dateStr: string | undefined | null
): BrevoTrackingIdentityFields {
  const ms = parseBrevoEventAtMs(dateStr)
  if (ms == null) {
    const date = String(dateStr || '').trim()
    return { date, eventAt: null, eventKeyAt: null }
  }
  return {
    date: new Date(ms).toISOString(),
    eventAt: new Date(ms),
    eventKeyAt: ms
  }
}

/** @deprecated use parseBrevoEventAtMs — kept for call sites that floored by second. */
export function floorBrevoEventAtMs(dateStr: string | undefined | null): number | null {
  return parseBrevoEventAtMs(dateStr)
}

/** @deprecated use brevoTrackingIdentityFromDate(...).date */
export function canonicalBrevoTrackingDate(dateStr: string | undefined | null): string {
  return brevoTrackingIdentityFromDate(dateStr).date || String(dateStr || '').trim()
}

/**
 * Cluster timestamps (ascending) so neighbors within tolerance share a cluster.
 * Used to collapse webhook/API duplicates without merging real retries minutes later.
 */
export function clusterBrevoEventTimestamps(
  items: Array<{ id: string; t: number }>,
  toleranceMs: number = BREVO_SOURCE_DEDUP_TOLERANCE_MS
): string[][] {
  const sorted = [...items].filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t)
  const clusters: Array<{ ids: string[]; maxT: number }> = []
  for (const item of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && item.t - last.maxT <= toleranceMs) {
      last.ids.push(item.id)
      last.maxT = Math.max(last.maxT, item.t)
    } else {
      clusters.push({ ids: [item.id], maxT: item.t })
    }
  }
  return clusters.map((c) => c.ids)
}
