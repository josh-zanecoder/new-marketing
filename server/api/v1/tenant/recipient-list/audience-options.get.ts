import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { requireTenantAdvancedRecipientFiltering } from '@server/utils/requireTenantAdvancedRecipientFiltering'
import { listCampaignSenderCandidates } from '@server/utils/campaign/listCampaignSenderCandidates'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import {
  MARKETING_STATUS_CATEGORIES,
  marketingStatusCategoryOf
} from '~~/shared/marketingStatusCategories'

const MAX_STATUS_OPTIONS = 100

/**
 * Advanced Recipient Filtering pickers.
 * - `loanOfficers`: CRM account owners the caller may send on behalf of (searchable with `q`).
 * - `statuses`: the predefined marketing categories (New & Active Leads, Active Borrowers, Past
 *   Clients, Inactive Leads, On Hold) with how many of the caller's marketable contacts fall in each.
 *   Tenants name their own statuses, so contacts are placed by rule (`marketingStatusCategoryOf`).
 */
export default defineEventHandler(async (event) => {
  const { auth } = await requireTenantAdvancedRecipientFiltering(event)

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const limitRaw = Number(query.limit)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 100

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)

  const [candidates, statusRows] = await Promise.all([
    listCampaignSenderCandidates(
      Contact as unknown as Parameters<typeof listCampaignSenderCandidates>[0],
      auth,
      { q, limit }
    ),
    Contact.aggregate<{ _id: string; n: number }>([
      {
        $match: mergeTenantOwnerEmailScopeFilter(
          withMarketableContactFilter({ status: { $type: 'string', $ne: '' } }),
          auth
        ) as Record<string, unknown>
      },
      { $group: { _id: { $toLower: { $trim: { input: '$status' } } }, n: { $sum: 1 } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { n: -1, _id: 1 } },
      { $limit: MAX_STATUS_OPTIONS }
    ])
  ])

  const categoryCounts = new Map<string, number>()
  for (const row of statusRows) {
    const key = marketingStatusCategoryOf(row._id)
    if (key) categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + row.n)
  }

  return {
    loanOfficers: candidates.map((c) => ({ email: c.email, name: c.displayName })),
    statuses: MARKETING_STATUS_CATEGORIES.map((category) => ({
      value: category.token,
      label: category.label,
      count: categoryCounts.get(category.key) ?? 0
    }))
  }
})
