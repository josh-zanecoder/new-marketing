/**
 * Predefined marketing categories for Advanced Recipient Filtering ("Borrower status").
 *
 * Tenants name their own borrower statuses (retail origination stores a slug such as `new_lead`),
 * so the five marketing categories are matched by rule on that slug instead of by exact name.
 * A category is stored on a campaign audience as `category:<key>` and evaluated against the
 * contact's current status, so a status added later joins the right category automatically.
 *
 * Rules are checked top to bottom and the first match wins (e.g. `inactive_lead` is an Inactive
 * Lead, never a New & Active Lead). The Mongo regex below encodes the same order.
 */
export const MARKETING_STATUS_CATEGORY_PREFIX = 'category:'

export type MarketingStatusCategoryKey =
  | 'on_hold'
  | 'inactive_leads'
  | 'past_clients'
  | 'active_borrowers'
  | 'new_active_leads'

interface CategoryDef {
  key: MarketingStatusCategoryKey
  label: string
  /** Substrings of the lower-cased status that place a contact in this category. */
  words: readonly string[]
}

/** Evaluation order (first match wins). */
const CATEGORIES_BY_PRIORITY: readonly CategoryDef[] = [
  { key: 'on_hold', label: 'On Hold', words: ['hold', 'paused', 'suspended'] },
  {
    key: 'inactive_leads',
    label: 'Inactive Leads',
    words: ['inactive', 'dead', 'lost', 'cold', 'unresponsive', 'dormant']
  },
  { key: 'past_clients', label: 'Past Clients', words: ['past', 'former', 'closed', 'funded', 'completed'] },
  { key: 'active_borrowers', label: 'Active Borrowers', words: ['borrower', 'client'] },
  {
    key: 'new_active_leads',
    label: 'New & Active Leads',
    words: ['lead', 'new', 'active', 'prospect', 'applicant']
  }
]

/** Order shown to people. */
const DISPLAY_ORDER: readonly MarketingStatusCategoryKey[] = [
  'new_active_leads',
  'active_borrowers',
  'past_clients',
  'inactive_leads',
  'on_hold'
]

export const MARKETING_STATUS_CATEGORIES: ReadonlyArray<{
  key: MarketingStatusCategoryKey
  label: string
  token: string
}> = DISPLAY_ORDER.map((key) => {
  const def = CATEGORIES_BY_PRIORITY.find((c) => c.key === key)!
  return { key, label: def.label, token: `${MARKETING_STATUS_CATEGORY_PREFIX}${key}` }
})

export function marketingStatusCategoryOf(rawStatus: unknown): MarketingStatusCategoryKey | null {
  const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : ''
  if (!status) return null
  for (const c of CATEGORIES_BY_PRIORITY) {
    if (c.words.some((w) => status.includes(w))) return c.key
  }
  return null
}

export function marketingStatusCategoryLabel(key: string): string {
  return CATEGORIES_BY_PRIORITY.find((c) => c.key === key)?.label ?? ''
}

/** `category:past_clients` → `past_clients`; anything else → null. */
export function marketingStatusCategoryKeyFromToken(token: unknown): MarketingStatusCategoryKey | null {
  const t = typeof token === 'string' ? token.trim().toLowerCase() : ''
  if (!t.startsWith(MARKETING_STATUS_CATEGORY_PREFIX)) return null
  const key = t.slice(MARKETING_STATUS_CATEGORY_PREFIX.length)
  return CATEGORIES_BY_PRIORITY.some((c) => c.key === key) ? (key as MarketingStatusCategoryKey) : null
}

/** Regex source (use with the `i` flag) equal to `marketingStatusCategoryOf(status) === key`. */
export function marketingStatusCategoryRegexSource(key: MarketingStatusCategoryKey): string {
  const index = CATEGORIES_BY_PRIORITY.findIndex((c) => c.key === key)
  const own = CATEGORIES_BY_PRIORITY[index]!.words.join('|')
  const earlier = CATEGORIES_BY_PRIORITY.slice(0, index).flatMap((c) => c.words)
  const guard = earlier.length ? `(?!.*(?:${earlier.join('|')}))` : ''
  return `^${guard}.*(?:${own})`
}

/** Converts saved statuses (category tokens or raw slugs) into category tokens, de-duplicated. */
export function categoryTokensFromStatuses(statuses: readonly string[]): string[] {
  const out = new Set<string>()
  for (const s of statuses) {
    const key = marketingStatusCategoryKeyFromToken(s) ?? marketingStatusCategoryOf(s)
    if (key) out.add(`${MARKETING_STATUS_CATEGORY_PREFIX}${key}`)
  }
  return [...out]
}
