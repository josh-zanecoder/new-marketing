import type { MarketingStatusCategoryKey } from './marketingStatusCategories'

/**
 * LendingQB loan status -> marketing category (exact-name lookup, no keyword guessing).
 *
 * The original LendingQB status is never modified; this only decides which marketing category a
 * contact belongs to. Status names come from "CRM Marketing Integrations - Dynamic Contact
 * Segmentation" and should be reviewed/confirmed with CRM / Operations.
 *
 * Matching is done on a normalized key (see `normalizeLendingQbStatus`), so casing, hyphens,
 * underscores, repeated spaces and the `LQB` / `LOB` / `QB` prefix do not matter, and a leading
 * "Loan " is optional ("Loan Funded" == "Funded", "Loan On-hold" == "On Hold").
 *
 * Statuses that are NOT in this table are intentionally uncategorized (they match no marketing
 * category) and are reported by the audience-options endpoint so Operations can confirm them.
 */

/** Keys are already normalized (lowercase words separated by one space, no source prefix). */
const CATEGORY_STATUS_KEYS: Readonly<Record<MarketingStatusCategoryKey, readonly string[]>> = {
  new_active_leads: [
    'new lead',
    'lead new', // native LendingQB spelling of "New Lead"
    'attempting contact',
    'contacted',
    'pre qual',
    'prequal',
    'pre approved',
    'preapproved',
    'preapproval'
  ],
  active_borrowers: [
    'loan open',
    'pre processing',
    'processing',
    'loan submitted',
    'in underwriting',
    'underwriting',
    'approved',
    'final underwriting',
    'clear to close',
    'docs out',
    'docs back',
    'docsback',
    'funding conditions',
    'final docs',
    'funding'
  ],
  past_clients: ['funded', 'shipped', 'sold', 'recorded', 'closed'],
  inactive_leads: [
    'not interested',
    'did not qualify',
    'did not quality', // spelling used in the requirements document
    'denied',
    'canceled',
    'cancelled'
  ],
  on_hold: ['suspended', 'on hold', 'onhold']
}

/**
 * Listed in the requirements as "needs clarification". They stay uncategorized until Operations
 * decides; add the normalized key to `CATEGORY_STATUS_KEYS` once confirmed.
 */
export const UNCLEAR_LENDINGQB_STATUS_KEYS: readonly string[] = [
  'legacy record',
  'archived',
  'loan'
]

const SOURCE_PREFIXES = new Set(['lqb', 'lob', 'qb'])

/**
 * Normalize a raw LendingQB status to a comparison key:
 * lowercase, non-alphanumerics -> single space, trimmed, leading LQB/LOB/QB token removed.
 */
export function normalizeLendingQbStatus(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  while (words.length > 1 && SOURCE_PREFIXES.has(words[0]!)) words.shift()
  return words.join(' ')
}

function withLoanVariants(key: string): string[] {
  if (key.startsWith('loan ')) return [key, key.slice('loan '.length)]
  return [key, `loan ${key}`]
}

const KEY_TO_CATEGORY: ReadonlyMap<string, MarketingStatusCategoryKey> = (() => {
  const map = new Map<string, MarketingStatusCategoryKey>()
  for (const [category, keys] of Object.entries(CATEGORY_STATUS_KEYS) as Array<
    [MarketingStatusCategoryKey, readonly string[]]
  >) {
    for (const key of keys) {
      for (const variant of withLoanVariants(key)) {
        if (variant && !map.has(variant)) map.set(variant, category)
      }
    }
  }
  // A bare "loan" is explicitly unclear, never a category.
  for (const key of UNCLEAR_LENDINGQB_STATUS_KEYS) map.delete(key)
  return map
})()

/** Category for a normalized key (`loanStatusKey`), or null when unmapped / unclear. */
export function lendingQbCategoryOfKey(key: unknown): MarketingStatusCategoryKey | null {
  if (typeof key !== 'string' || !key) return null
  return KEY_TO_CATEGORY.get(key) ?? null
}

/** Category for a raw LendingQB status string, or null when unmapped / unclear. */
export function lendingQbCategoryOf(rawStatus: unknown): MarketingStatusCategoryKey | null {
  return lendingQbCategoryOfKey(normalizeLendingQbStatus(rawStatus))
}

/** Every normalized key (incl. "loan " variants) that belongs to `category`; for `$in` queries. */
export function lendingQbStatusKeysForCategory(category: MarketingStatusCategoryKey): string[] {
  const keys: string[] = []
  for (const [key, cat] of KEY_TO_CATEGORY) {
    if (cat === category) keys.push(key)
  }
  return keys
}
