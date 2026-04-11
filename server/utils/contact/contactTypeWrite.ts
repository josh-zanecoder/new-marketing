import type { FilterQuery } from 'mongoose'
import type { ContactKind } from '@server/types/tenant/contact.model'

const KIND_PRIORITY: ContactKind[] = ['client', 'prospect', 'contact']

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

/** Pick a single `contactKind` enum for legacy queries / merge fields from `contactType` keys. */
export function deriveContactKindFromContactTypes(types: string[]): ContactKind {
  const set = new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean))
  for (const k of KIND_PRIORITY) {
    if (set.has(k)) return k
  }
  return 'contact'
}

/**
 * Mutates a `$set`-style object: sets normalized `contactType` (string[]) and derived `contactKind`.
 * Call before `Contact.updateOne` / etc. when the payload may include `contactType` and/or `contactKind`.
 */
export function applyContactTypeFieldsToSetDoc(set: Record<string, unknown>): void {
  const rawArr = set.contactType
  const rawKind = set.contactKind

  let types = normalizeContactTypeInput(rawArr)
  if (types.length === 0 && rawKind != null && rawKind !== '') {
    types = normalizeContactTypeInput(rawKind)
  }
  if (types.length === 0) {
    types = ['contact']
  }

  set.contactType = types
  set.contactKind = deriveContactKindFromContactTypes(types)
}

/** Recipient list audience: match `contactType` array or legacy `contactKind` when types are empty. */
export function audienceBaseQuery(audience: ContactKind): FilterQuery<Record<string, unknown>> {
  return {
    deletedAt: null,
    $or: [
      { contactType: audience },
      {
        $and: [
          { contactKind: audience },
          {
            $or: [
              { contactType: { $exists: false } },
              { contactType: null },
              { contactType: { $size: 0 } }
            ]
          }
        ]
      }
    ]
  }
}
