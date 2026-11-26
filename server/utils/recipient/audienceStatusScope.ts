/**
 * Borrower-status scope for Advanced Recipient Filtering.
 * Stored on the recipient list (`audienceStatuses`) and ANDed onto the filter query everywhere the
 * list is evaluated (preview, full rebuild, per-contact sync), so changing a contact's status
 * moves them in or out of the audience before the next send.
 */
import {
  marketingStatusCategoryKeyFromToken,
  marketingStatusCategoryRegexSource
} from '~~/shared/marketingStatusCategories'

export function escapeStatusRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function audienceStatusClause(statuses: string[]): Record<string, unknown> | null {
  const uniq = [...new Set(statuses.map((s) => s.trim()).filter(Boolean))]
  if (!uniq.length) return null
  return {
    status: {
      $in: uniq.map((s) => {
        // `category:<key>` = one of the predefined marketing categories, matched by rule on the
        // contact's current status; anything else is an exact status slug.
        const category = marketingStatusCategoryKeyFromToken(s)
        return category
          ? new RegExp(marketingStatusCategoryRegexSource(category), 'i')
          : new RegExp(`^${escapeStatusRegex(s)}$`, 'i')
      })
    }
  }
}

export function withAudienceStatusScope(
  query: Record<string, unknown>,
  statuses: unknown
): Record<string, unknown> {
  const list = Array.isArray(statuses)
    ? statuses.filter((s): s is string => typeof s === 'string')
    : []
  const clause = audienceStatusClause(list)
  if (!clause) return query
  return { $and: [query, clause] }
}
