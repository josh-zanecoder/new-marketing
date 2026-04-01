import type { FilterQuery } from 'mongoose'
import type { ContactKind } from '../types/tenant/contact.model'
import type {
  RecipientListCriterion,
  RecipientListFilterMode
} from '../types/tenant/recipientList.model'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One key per logical field so `channel`/`Channel` merge; same-field values always OR together in AND mode. */
function canonicalCriterionKey(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

/** Case-insensitive exact match on a string field. */
function exactField(path: string, value: string): Record<string, unknown> {
  return {
    [path]: { $regex: new RegExp(`^${escapeRegex(value)}$`, 'i') }
  }
}

function orExactField(path: string, values: string[]): Record<string, unknown> {
  const uniq = [...new Set(values)].filter(Boolean)
  if (uniq.length === 0) return {}
  if (uniq.length === 1) {
    const only = uniq[0]
    if (only === undefined) return {}
    return exactField(path, only)
  }
  return { $or: uniq.map((v) => exactField(path, v)) }
}

/** One criterion row → leaf condition (used when `filterMode` is `or`). */
function criterionToLeaf(row: RecipientListCriterion): Record<string, unknown> | null {
  const prop = canonicalCriterionKey(row.property)
  const val = String(row.value ?? '').trim()
  if (!prop || !val) return null

  switch (prop) {
    case 'state':
      return exactField('address.state', val)
    case 'city':
      return exactField('address.city', val)
    case 'county':
      return exactField('address.county', val)
    case 'street':
      return {
        'address.street': { $regex: new RegExp(escapeRegex(val), 'i') }
      }
    case 'channel':
      return exactField('channel', val)
    case 'company':
      return exactField('company', val)
    case 'source':
      return exactField('source', val)
    case 'email':
      return exactField('email', val)
    case 'search':
      return {
        $or: [
          { firstName: { $regex: new RegExp(escapeRegex(val), 'i') } },
          { lastName: { $regex: new RegExp(escapeRegex(val), 'i') } },
          { name: { $regex: new RegExp(escapeRegex(val), 'i') } },
          { email: { $regex: new RegExp(escapeRegex(val), 'i') } }
        ]
      }
    default:
      return null
  }
}

function buildAndMode(
  audience: ContactKind,
  filters: RecipientListCriterion[]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = {
    deletedAt: null,
    contactKind: audience
  }

  if (!filters.length) {
    return base
  }

  const byProp = new Map<string, string[]>()
  for (const row of filters) {
    const key = canonicalCriterionKey(row.property)
    const val = String(row.value ?? '').trim()
    if (!key || !val) continue
    const list = byProp.get(key) ?? []
    list.push(val)
    byProp.set(key, list)
  }

  const andParts: Record<string, unknown>[] = []

  for (const [prop, values] of byProp) {
    const uniq = [...new Set(values)].filter(Boolean)
    if (!uniq.length) continue

    switch (prop) {
      case 'state':
        andParts.push(orExactField('address.state', uniq))
        break
      case 'city':
        andParts.push(orExactField('address.city', uniq))
        break
      case 'county':
        andParts.push(orExactField('address.county', uniq))
        break
      case 'street': {
        const ors = uniq.map((v) => ({
          'address.street': { $regex: new RegExp(escapeRegex(v), 'i') }
        }))
        if (ors.length === 1) {
          const one = ors[0]
          if (one) andParts.push(one)
        } else {
          andParts.push({ $or: ors })
        }
        break
      }
      case 'channel':
        andParts.push(orExactField('channel', uniq))
        break
      case 'company':
        andParts.push(orExactField('company', uniq))
        break
      case 'source':
        andParts.push(orExactField('source', uniq))
        break
      case 'email':
        andParts.push(orExactField('email', uniq))
        break
      case 'search': {
        const v = uniq[0]
        if (v) {
          andParts.push({
            $or: [
              { firstName: { $regex: new RegExp(escapeRegex(v), 'i') } },
              { lastName: { $regex: new RegExp(escapeRegex(v), 'i') } },
              { name: { $regex: new RegExp(escapeRegex(v), 'i') } },
              { email: { $regex: new RegExp(escapeRegex(v), 'i') } }
            ]
          })
        }
        break
      }
      default:
        break
    }
  }

  if (!andParts.length) {
    return base
  }

  return {
    ...base,
    $and: andParts
  }
}

/** OR together criteria from one UI filter row (e.g. multiple state tokens). */
function combineCriteriaGroup(
  criteria: RecipientListCriterion[]
): Record<string, unknown> | null {
  const leaves: Record<string, unknown>[] = []
  for (const c of criteria) {
    const leaf = criterionToLeaf(c)
    if (leaf && Object.keys(leaf).length) {
      leaves.push(leaf)
    }
  }
  if (!leaves.length) return null
  if (leaves.length === 1) {
    return leaves[0] ?? null
  }
  return { $or: leaves }
}

/**
 * AND mode with explicit **filter rows**: each group is one UI row; groups are AND’d.
 * Multiple criteria inside a group (token expansion) are OR’d. Two rows both on channel
 * become channel=A AND channel=B → no matching contacts.
 */
function buildAndModeGrouped(
  audience: ContactKind,
  groups: RecipientListCriterion[][]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = {
    deletedAt: null,
    contactKind: audience
  }

  const nonEmpty = groups.filter((g) => g.length > 0)
  if (!nonEmpty.length) {
    return base
  }

  const andParts: Record<string, unknown>[] = []
  for (const g of nonEmpty) {
    const part = combineCriteriaGroup(g)
    if (part) {
      andParts.push(part)
    }
  }

  if (!andParts.length) {
    return base
  }
  if (andParts.length === 1) {
    return { ...base, ...andParts[0] }
  }
  return {
    ...base,
    $and: andParts
  }
}

function buildOrMode(
  audience: ContactKind,
  filters: RecipientListCriterion[]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = {
    deletedAt: null,
    contactKind: audience
  }

  if (!filters.length) {
    return base
  }

  const orParts: Record<string, unknown>[] = []
  for (const row of filters) {
    const leaf = criterionToLeaf(row)
    if (leaf && Object.keys(leaf).length) {
      orParts.push(leaf)
    }
  }

  if (!orParts.length) {
    return base
  }
  if (orParts.length === 1) {
    return { ...base, ...orParts[0] }
  }
  return {
    ...base,
    $or: orParts
  }
}

/**
 * Maps saved list criteria → Mongo filter on `Contact`.
 *
 * **`and` mode:** With `criterionGroups` (one array per UI filter row), each group is
 * OR’d internally, then groups are AND’d—so two channel rows require both values and
 * usually match **no** contacts. Without groups (legacy), criteria are grouped by field
 * as before (same field → OR).
 *
 * **`or` mode:** Each criterion row is an alternative (`$or` of leaves).
 */
export function buildContactFilterQuery(
  audience: ContactKind,
  filters: RecipientListCriterion[],
  filterMode: RecipientListFilterMode = 'and',
  criterionGroups?: RecipientListCriterion[][]
): FilterQuery<Record<string, unknown>> {
  if (filterMode === 'or') {
    return buildOrMode(audience, filters)
  }
  if (criterionGroups && criterionGroups.length > 0) {
    return buildAndModeGrouped(audience, criterionGroups)
  }
  return buildAndMode(audience, filters)
}
