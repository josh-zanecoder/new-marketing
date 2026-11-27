/**
 * Borrower-status scope for Advanced Recipient Filtering.
 * Stored on the recipient list (`audienceStatuses`) and ANDed onto the filter query everywhere the
 * list is evaluated (preview, full rebuild, per-contact sync), so changing a contact's status
 * moves them in or out of the audience before the next send.
 *
 * Category tokens (`category:<key>`) are evaluated one of two ways:
 * - default (toggle OFF): keyword rules on the contact's borrower `status`
 *   (`marketingStatusCategoryRegexSource`);
 * - LendingQB toggle ON for the tenant: exact lookup of the synced LendingQB `loanStatusKey`
 *   (`lendingQbStatusCategories`) only — never the hardcoded CRM `status`.
 */
import type { Connection } from 'mongoose'
import {
  marketingStatusCategoryKeyFromToken,
  marketingStatusCategoryRegexSource,
  type MarketingStatusCategoryKey
} from '~~/shared/marketingStatusCategories'
import { lendingQbStatusKeysForCategory } from '~~/shared/lendingQbStatusCategories'
import { isLendingQbStatusEnabledForConnection } from '@server/utils/recipient/lendingQbStatusFeature'

export type AudienceStatusScopeOptions = {
  /** Tenant has the LendingQB loan-status integration enabled. */
  lendingQb?: boolean
}

export function escapeStatusRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function categoryKeywordRegex(category: MarketingStatusCategoryKey): RegExp {
  return new RegExp(marketingStatusCategoryRegexSource(category), 'i')
}

/** Contact-level clause for one category when LendingQB statuses drive categories. */
export function lendingQbCategoryClause(category: MarketingStatusCategoryKey): Record<string, unknown> {
  return { loanStatusKey: { $in: lendingQbStatusKeysForCategory(category) } }
}

export function audienceStatusClause(
  statuses: string[],
  options: AudienceStatusScopeOptions = {}
): Record<string, unknown> | null {
  const uniq = [...new Set(statuses.map((s) => s.trim()).filter(Boolean))]
  if (!uniq.length) return null

  const plain: RegExp[] = []
  const categories: MarketingStatusCategoryKey[] = []
  for (const s of uniq) {
    // `category:<key>` = one of the predefined marketing categories; anything else is an exact
    // status slug.
    const category = marketingStatusCategoryKeyFromToken(s)
    if (category) {
      if (options.lendingQb) categories.push(category)
      else plain.push(categoryKeywordRegex(category))
    } else {
      plain.push(new RegExp(`^${escapeStatusRegex(s)}$`, 'i'))
    }
  }

  if (!categories.length) return { status: { $in: plain } }

  const branches: Record<string, unknown>[] = []
  if (plain.length) branches.push({ status: { $in: plain } })
  for (const category of categories) branches.push(lendingQbCategoryClause(category))
  return { $or: branches }
}

function statusList(statuses: unknown): string[] {
  return Array.isArray(statuses) ? statuses.filter((s): s is string => typeof s === 'string') : []
}

export function withAudienceStatusScope(
  query: Record<string, unknown>,
  statuses: unknown,
  options: AudienceStatusScopeOptions = {}
): Record<string, unknown> {
  const clause = audienceStatusClause(statusList(statuses), options)
  if (!clause) return query
  return { $and: [query, clause] }
}

/**
 * Tenant-aware variant used by the list evaluators. Only consults the tenant toggle when the list
 * actually has a category token, so classic lists never pay for the registry lookup.
 */
export async function withAudienceStatusScopeForTenant(
  tenantConn: Pick<Connection, 'name'>,
  query: Record<string, unknown>,
  statuses: unknown
): Promise<Record<string, unknown>> {
  const list = statusList(statuses)
  const hasCategory = list.some((s) => marketingStatusCategoryKeyFromToken(s.trim()) !== null)
  const lendingQb = hasCategory ? await isLendingQbStatusEnabledForConnection(tenantConn) : false
  return withAudienceStatusScope(query, list, { lendingQb })
}
