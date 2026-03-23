import type { FilterQuery } from 'mongoose'
import type { ContactKind } from '../types/tenant/contact.model'
import type { RecipientListCriterion } from '../types/tenant/recipientList.model'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

/**
 * Maps saved list criteria → Mongo filter on `Contact`.
 * Example: address.state → `address.state` equals criterion value (case-insensitive);
 * multiple `state` rows → contact matches if state equals any of those values (OR).
 */
export function buildContactFilterQuery(
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
    const key = String(row.property ?? '').trim()
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
