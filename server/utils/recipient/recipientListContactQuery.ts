import type { FilterQuery } from 'mongoose'
import type { ContactKind } from '@server/types/tenant/contact.model'
import { audienceBaseQuery } from '@server/utils/contact/contactTypeWrite'
import type {
  RecipientListCriterion,
  RecipientListFilterMode
} from '@server/types/tenant/recipientList.model'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function canonicalCriterionKey(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

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
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)
  if (!filters.length) return base

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

  if (!andParts.length) return base
  return { ...base, $and: andParts }
}

function combineCriteriaGroup(
  criteria: RecipientListCriterion[]
): Record<string, unknown> | null {
  const leaves: Record<string, unknown>[] = []
  for (const c of criteria) {
    const leaf = criterionToLeaf(c)
    if (leaf && Object.keys(leaf).length) leaves.push(leaf)
  }
  if (!leaves.length) return null
  if (leaves.length === 1) return leaves[0] ?? null
  return { $or: leaves }
}

/** Left-associative: (...((L0 op0 L1) op1 L2) ...). */
function foldLeftAssociativeChain(
  leaves: Record<string, unknown>[],
  joins: ('and' | 'or')[]
): Record<string, unknown> {
  const first = leaves[0]
  if (first === undefined) return {}
  let acc: Record<string, unknown> = first
  for (let i = 1; i < leaves.length; i++) {
    const leaf = leaves[i]
    if (!leaf) continue
    const opKey = joins[i - 1] === 'or' ? '$or' : '$and'
    acc = { [opKey]: [acc, leaf] }
  }
  return acc
}

function mergeAudienceWithExpr(
  audience: ContactKind,
  expr: Record<string, unknown>
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)
  return { ...base, ...expr } as FilterQuery<Record<string, unknown>>
}

/** One leaf per filter row (OR inside row when a row expands to multiple criteria). */
export function buildRowChainQuery(
  audience: ContactKind,
  rowGroups: RecipientListCriterion[][],
  joins: ('and' | 'or')[]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)
  const rowLeaves: Record<string, unknown>[] = []
  for (const g of rowGroups) {
    const part = combineCriteriaGroup(g)
    if (part && Object.keys(part).length) rowLeaves.push(part)
  }
  if (rowLeaves.length === 0) return base
  if (rowLeaves.length === 1) {
    const one = rowLeaves[0]
    return one ? mergeAudienceWithExpr(audience, one) : base
  }
  const need = rowLeaves.length - 1
  const norm: ('and' | 'or')[] = []
  for (let i = 0; i < need; i++) {
    norm[i] = joins[i] === 'or' ? 'or' : 'and'
  }
  return mergeAudienceWithExpr(audience, foldLeftAssociativeChain(rowLeaves, norm))
}

/** Single chain over flat criteria (no row grouping); same left-associative semantics. */
export function buildFlatCriterionChainQuery(
  audience: ContactKind,
  criteria: RecipientListCriterion[],
  joins: ('and' | 'or')[]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)
  const leaves: Record<string, unknown>[] = []
  for (const c of criteria) {
    const leaf = criterionToLeaf(c)
    if (leaf && Object.keys(leaf).length) leaves.push(leaf)
  }
  if (leaves.length === 0) return base
  if (leaves.length === 1) {
    const one = leaves[0]
    return one ? mergeAudienceWithExpr(audience, one) : base
  }
  const need = leaves.length - 1
  const norm: ('and' | 'or')[] = []
  for (let i = 0; i < need; i++) {
    norm[i] = joins[i] === 'or' ? 'or' : 'and'
  }
  return mergeAudienceWithExpr(audience, foldLeftAssociativeChain(leaves, norm))
}

function buildAndModeGrouped(
  audience: ContactKind,
  groups: RecipientListCriterion[][]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)

  const nonEmpty = groups.filter((g) => g.length > 0)
  if (!nonEmpty.length) return base

  const andParts: Record<string, unknown>[] = []
  for (const g of nonEmpty) {
    const part = combineCriteriaGroup(g)
    if (part) andParts.push(part)
  }

  if (!andParts.length) return base
  if (andParts.length === 1) return { ...base, ...andParts[0] }
  return { ...base, $and: andParts }
}

function buildOrMode(
  audience: ContactKind,
  filters: RecipientListCriterion[]
): FilterQuery<Record<string, unknown>> {
  const base: FilterQuery<Record<string, unknown>> = audienceBaseQuery(audience)
  if (!filters.length) return base

  const orParts: Record<string, unknown>[] = []
  for (const row of filters) {
    const leaf = criterionToLeaf(row)
    if (leaf && Object.keys(leaf).length) orParts.push(leaf)
  }

  if (!orParts.length) return base
  if (orParts.length === 1) return { ...base, ...orParts[0] }
  return { ...base, $or: orParts }
}

export function buildContactFilterQuery(
  audience: ContactKind,
  filters: RecipientListCriterion[],
  filterMode: RecipientListFilterMode = 'and',
  criterionGroups?: RecipientListCriterion[][],
  /** When length matches row-group gaps or flat filter gaps, overrides grouped/flat AND defaults. */
  storedCriterionJoins?: ('and' | 'or')[] | null
): FilterQuery<Record<string, unknown>> {
  const groups = (criterionGroups ?? []).filter((g) => g.length > 0)

  if (Array.isArray(storedCriterionJoins) && groups.length > 0) {
    const need = groups.length - 1
    if (storedCriterionJoins.length === need) {
      return buildRowChainQuery(audience, groups, storedCriterionJoins)
    }
  }

  if (
    Array.isArray(storedCriterionJoins) &&
    groups.length === 0 &&
    filters.length > 0
  ) {
    const need = Math.max(0, filters.length - 1)
    if (storedCriterionJoins.length === need) {
      return buildFlatCriterionChainQuery(audience, filters, storedCriterionJoins)
    }
  }

  if (filterMode === 'or') return buildOrMode(audience, filters)
  if (groups.length > 0) {
    return buildAndModeGrouped(audience, groups)
  }
  return buildAndMode(audience, filters)
}
