import type { Connection, FilterQuery } from 'mongoose'
import {
  LAST_RESORT_CONTACT_TYPE_KEY,
  resolveDefaultContactTypeKey
} from '@server/utils/contact/resolveDefaultContactTypeKey'

/** Normalize inbound values to unique lowercase keys (order preserved). */
export function normalizeContactTypeInput(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    const out: string[] = []
    const seen = new Set<string>()
    for (const x of raw) {
      const k = String(x).trim().toLowerCase()
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(k)
    }
    return out
  }
  const s = String(raw).trim().toLowerCase()
  return s ? [s] : []
}

/**
 * Mutates a `$set`-style object: sets normalized `contactType` (string[]) only.
 * Inbound payloads may still send legacy `contactKind` as a string — it is folded into `contactType`.
 * When still empty, uses the tenant’s first enabled `contact_types` key when `tenantConn` is passed.
 */
export async function applyContactTypeFieldsToSetDoc(
  set: Record<string, unknown>,
  tenantConn?: Connection | null
): Promise<void> {
  const rawArr = set.contactType
  const rawKind = set.contactKind

  let types = normalizeContactTypeInput(rawArr)
  if (types.length === 0 && rawKind != null && rawKind !== '') {
    types = normalizeContactTypeInput(rawKind)
  }
  if (types.length === 0) {
    types = [
      tenantConn
        ? await resolveDefaultContactTypeKey(tenantConn)
        : LAST_RESORT_CONTACT_TYPE_KEY
    ]
  }

  set.contactType = types
  delete set.contactKind
}

/** Recipient list audience: `contactType` array must include the audience key. */
export function audienceBaseQuery(audience: string): FilterQuery<Record<string, unknown>> {
  return {
    deletedAt: null,
    contactType: audience
  }
}
