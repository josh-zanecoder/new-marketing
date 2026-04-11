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

export function primaryLifecycleKeyFromTypes(types: string[]): ContactKind {
  const set = new Set(types.map((t) => t.trim().toLowerCase()).filter(Boolean))
  for (const k of KIND_PRIORITY) {
    if (set.has(k)) return k
  }
  return 'contact'
}

/** @deprecated Use `primaryLifecycleKeyFromTypes`. */
export const deriveContactKindFromContactTypes = primaryLifecycleKeyFromTypes

/**
 * Mutates a `$set`-style object: sets normalized `contactType` (string[]) only.
 * Inbound payloads may still send legacy `contactKind` as a string — it is folded into `contactType`.
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
  delete set.contactKind
}

/** Recipient list audience: `contactType` array must include the audience key. */
export function audienceBaseQuery(audience: ContactKind): FilterQuery<Record<string, unknown>> {
  return {
    deletedAt: null,
    contactType: audience
  }
}
