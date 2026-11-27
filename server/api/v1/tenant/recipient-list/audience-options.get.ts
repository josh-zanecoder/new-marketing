import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { requireTenantAdvancedRecipientFiltering } from '@server/utils/requireTenantAdvancedRecipientFiltering'
import { listCampaignSenderCandidates } from '@server/utils/campaign/listCampaignSenderCandidates'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { isLendingQbStatusEnabledForDb } from '@server/utils/recipient/lendingQbStatusFeature'
import {
  MARKETING_STATUS_CATEGORIES,
  marketingStatusCategoryOf
} from '~~/shared/marketingStatusCategories'
import { lendingQbCategoryOfKey } from '~~/shared/lendingQbStatusCategories'

const MAX_STATUS_OPTIONS = 100
const MAX_UNMAPPED_STATUSES = 25

/**
 * Advanced Recipient Filtering pickers.
 * - `loanOfficers`: CRM account owners the caller may send on behalf of (searchable with `q`).
 * - `statuses`: the predefined marketing categories (New & Active Leads, Active Borrowers, Past
 *   Clients, Inactive Leads, On Hold) with how many of the caller's marketable contacts fall in each.
 *   By default contacts are placed by keyword rule on their borrower status
 *   (`marketingStatusCategoryOf`). When the tenant's LendingQB toggle is ON, contacts are placed
 *   only by an exact lookup of their synced LendingQB loan status (same semantics as the audience
 *   filter); contacts without one are not counted in any category — there is no fallback to the
 *   CRM borrower status.
 * - `source`: which rule set produced the counts (`borrower-status` | `lendingqb`).
 * - `unmappedLoanStatuses`: LendingQB statuses that match no category (e.g. "Legacy Record"),
 *   only when the toggle is ON, so Operations can confirm where they belong.
 */
export default defineEventHandler(async (event) => {
  const { auth, dbName } = await requireTenantAdvancedRecipientFiltering(event)

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const limitRaw = Number(query.limit)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 100

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)
  const lendingQb = await isLendingQbStatusEnabledForDb(dbName)

  const scoped = (extra: Record<string, unknown>) =>
    mergeTenantOwnerEmailScopeFilter(withMarketableContactFilter(extra), auth) as Record<
      string,
      unknown
    >

  const [candidates, statusRows, loanRows] = await Promise.all([
    listCampaignSenderCandidates(
      Contact as unknown as Parameters<typeof listCampaignSenderCandidates>[0],
      auth,
      { q, limit }
    ),
    lendingQb
      ? Promise.resolve([] as Array<{ _id: string; n: number }>)
      : Contact.aggregate<{ _id: string; n: number }>([
          { $match: scoped({ status: { $type: 'string', $ne: '' } }) },
          { $group: { _id: { $toLower: { $trim: { input: '$status' } } }, n: { $sum: 1 } } },
          { $match: { _id: { $ne: '' } } },
          { $sort: { n: -1, _id: 1 } },
          { $limit: MAX_STATUS_OPTIONS }
        ]),
    lendingQb
      ? Contact.aggregate<{ _id: string; label: string; n: number }>([
          { $match: scoped({ loanStatusKey: { $type: 'string', $ne: '' } }) },
          { $group: { _id: '$loanStatusKey', label: { $first: '$loanStatus' }, n: { $sum: 1 } } },
          { $sort: { n: -1, _id: 1 } },
          { $limit: MAX_STATUS_OPTIONS }
        ])
      : Promise.resolve([] as Array<{ _id: string; label: string; n: number }>)
  ])

  const categoryCounts = new Map<string, number>()
  for (const row of statusRows) {
    const key = marketingStatusCategoryOf(row._id)
    if (key) categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + row.n)
  }

  const unmappedLoanStatuses: Array<{ status: string; count: number }> = []
  for (const row of loanRows) {
    const key = lendingQbCategoryOfKey(row._id)
    if (key) categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + row.n)
    else if (unmappedLoanStatuses.length < MAX_UNMAPPED_STATUSES) {
      unmappedLoanStatuses.push({ status: row.label || row._id, count: row.n })
    }
  }

  return {
    loanOfficers: candidates.map((c) => ({ email: c.email, name: c.displayName })),
    source: lendingQb ? 'lendingqb' : 'borrower-status',
    statuses: MARKETING_STATUS_CATEGORIES.map((category) => ({
      value: category.token,
      label: category.label,
      count: categoryCounts.get(category.key) ?? 0
    })),
    ...(lendingQb ? { unmappedLoanStatuses } : {})
  }
})
