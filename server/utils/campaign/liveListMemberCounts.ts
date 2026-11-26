import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean } from '@server/types/tenant/campaign.model'
import { isCampaignLiveListAudience } from '~~/shared/campaignAdvancedRecipientFilters'

/**
 * Current member count per recipient list for live-list campaigns (Advanced Recipient Filtering).
 * Those campaigns store no ManualRecipient snapshot, so index counts come from list membership.
 * Keyed by list id string; only lists used by a live campaign are queried.
 */
export async function liveListMemberCounts(
  conn: Connection,
  campaigns: Array<Pick<CampaignLean, 'recipientsType' | 'recipientsListId' | 'liveListAudience'>>
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const listIds = [
    ...new Set(
      campaigns
        .filter((c) => isCampaignLiveListAudience(c))
        .map((c) => String(c.recipientsListId ?? '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]
  if (!listIds.length) return counts

  const { RecipientListMember } = getTenantClientModels(conn)
  const rows = await RecipientListMember.aggregate<{ _id: unknown; n: number }>([
    {
      $match: {
        recipientListId: { $in: listIds.map((id) => new mongoose.Types.ObjectId(id)) }
      }
    },
    { $group: { _id: '$recipientListId', n: { $sum: 1 } } }
  ])
  for (const row of rows) counts.set(String(row._id), row.n)
  return counts
}
