import type { ContactKind } from '../types/tenant/contact.model'
import type {
  RecipientListCriterion,
  RecipientListFilterMode
} from '../types/tenant/recipientList.model'
import { canonicalRecipientFilterFieldsFromDoc } from './recipientFilterValidation'

const AUDIENCES = new Set<ContactKind>(['prospect', 'client', 'contact'])

export function tokenizePropertyValue(raw: unknown): string[] {
  if (raw == null || typeof raw !== 'string') return []
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function asAudience(raw: unknown): ContactKind {
  if (typeof raw === 'string' && AUDIENCES.has(raw as ContactKind)) {
    return raw as ContactKind
  }
  return 'prospect'
}

/** Maps old embedded `filter` document → audience + criteria rows. */
export function legacyFilterToAudienceAndCriteria(
  filter: Record<string, unknown> | null | undefined
): { audience: ContactKind; filters: RecipientListCriterion[] } {
  const f = filter ?? {}
  const kinds = f.contactKinds as unknown
  let audience: ContactKind = 'prospect'
  if (Array.isArray(kinds) && kinds.length && typeof kinds[0] === 'string') {
    audience = asAudience(kinds[0])
  }

  const filters: RecipientListCriterion[] = []
  const take = (k: string): string =>
    typeof f[k] === 'string' ? (f[k] as string).trim() : ''

  const state = take('state')
  if (state) {
    for (const t of tokenizePropertyValue(state)) {
      filters.push({ property: 'state', value: t })
    }
  }
  const city = take('city')
  if (city) filters.push({ property: 'city', value: city })
  const county = take('county')
  if (county) filters.push({ property: 'county', value: county })
  const channel = take('channel')
  if (channel) filters.push({ property: 'channel', value: channel })
  const company = take('company')
  if (company) filters.push({ property: 'company', value: company })
  const search = take('search')
  if (search) filters.push({ property: 'search', value: search })

  const sources = f.sources
  if (Array.isArray(sources)) {
    for (const s of sources) {
      if (typeof s === 'string' && s.trim()) {
        filters.push({ property: 'source', value: s.trim() })
      }
    }
  }

  return { audience, filters }
}

function mapCriteriaRows(
  rows: RecipientListCriterion[]
): RecipientListCriterion[] {
  return rows.map((c) => ({
    property: String(c.property ?? '').trim() || 'unknown',
    value: String(c.value ?? '').trim()
  }))
}

function filterModeFromDoc(doc: Record<string, unknown>): RecipientListFilterMode {
  return doc.filterMode === 'or' ? 'or' : 'and'
}

export function normalizeRecipientListDoc(
  doc: Record<string, unknown>
): {
  audience: ContactKind
  filters: RecipientListCriterion[]
  filterMode: RecipientListFilterMode
} {
  const rows = Array.isArray(doc.filters)
    ? (doc.filters as RecipientListCriterion[])
    : []
  const hasSavedCriteria = rows.some(
    (c) => String(c?.property ?? '').trim() || String(c?.value ?? '').trim()
  )

  if (
    hasSavedCriteria &&
    typeof doc.audience === 'string' &&
    AUDIENCES.has(doc.audience as ContactKind)
  ) {
    return {
      audience: doc.audience as ContactKind,
      filters: mapCriteriaRows(rows),
      filterMode: filterModeFromDoc(doc)
    }
  }

  const legacy = doc.filter
  if (legacy && typeof legacy === 'object' && Object.keys(legacy as object).length > 0) {
    const legacyResult = legacyFilterToAudienceAndCriteria(
      legacy as Record<string, unknown>
    )
    return { ...legacyResult, filterMode: 'and' }
  }

  if (typeof doc.audience === 'string' && AUDIENCES.has(doc.audience as ContactKind)) {
    return {
      audience: doc.audience as ContactKind,
      filters: mapCriteriaRows(rows),
      filterMode: filterModeFromDoc(doc)
    }
  }

  return { audience: 'prospect', filters: [], filterMode: 'and' }
}

/** Build criteria from a registry recipient_filter row (after value is resolved). */
export function registryDocToCriteria(doc: {
  property?: string
  propertyType?: string | null
  propertyValue?: string
}): RecipientListCriterion[] {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(doc)
  const tokens = tokenizePropertyValue(doc.propertyValue)
  if (property === 'none') return []
  if (!tokens.length) return []

  switch (property) {
    case 'address':
      if (propertyType === 'state') {
        return tokens.map((value) => ({ property: 'state', value }))
      }
      if (propertyType === 'city') {
        return [{ property: 'city', value: tokens[0] ?? '' }]
      }
      if (propertyType === 'county') {
        return [{ property: 'county', value: tokens[0] ?? '' }]
      }
      if (propertyType === 'street') {
        return [{ property: 'street', value: tokens[0] ?? '' }]
      }
      return []
    case 'channel':
      return [{ property: 'channel', value: tokens[0] ?? '' }]
    case 'company':
      return [{ property: 'company', value: tokens[0] ?? '' }]
    case 'source':
      return tokens.map((value) => ({ property: 'source', value }))
    case 'email':
      return [{ property: 'email', value: tokens[0] ?? '' }]
    default:
      return []
  }
}

/**
 * Best-effort UI rows for lists saved before `filterRows` existed on the document.
 */
export function suggestFilterRowsFromCriteria(
  audience: ContactKind,
  criteria: RecipientListCriterion[],
  registryDocs: Record<string, unknown>[]
): { recipientFilterId: string; listPropertyValue: string }[] {
  const pool = registryDocs.filter(
    (d) => d.enabled === true && d.contactType === audience
  )
  const used = new Set<string>()
  const rows: { recipientFilterId: string; listPropertyValue: string }[] = []

  for (const c of criteria) {
    const cProp = String(c.property ?? '').trim()
    const cVal = String(c.value ?? '').trim()
    if (!cProp || !cVal) continue

    let matched = false
    for (const doc of pool) {
      const idRaw = doc._id
      const id = idRaw != null ? String(idRaw) : ''
      if (!id || used.has(id)) continue

      const tryValues = [cVal]
      const reg =
        typeof doc.propertyValue === 'string' ? doc.propertyValue.trim() : ''
      if (reg && !tryValues.includes(reg)) tryValues.push(reg)

      for (const pv of tryValues) {
        const crits = registryDocToCriteria({
          ...doc,
          propertyValue: pv
        } as Parameters<typeof registryDocToCriteria>[0])
        if (crits.some((x) => x.property === cProp && x.value === cVal)) {
          rows.push({ recipientFilterId: id, listPropertyValue: cVal })
          used.add(id)
          matched = true
          break
        }
      }
      if (matched) break
    }
  }

  return rows
}
