import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

/**
 * Removes an auto-created campaign audience list (Advanced Recipient Filtering) once no campaign
 * follows it any more. Lists a person made themselves (`campaignAudience` not set) are never touched.
 * Orphans are not harmless: every contact change would keep re-evaluating them.
 */
export async function removeCampaignAudienceListIfUnused(
  conn: Connection,
  listId: string
): Promise<boolean> {
  const id = String(listId ?? '').trim()
  if (!id) return false
  const { Campaign, RecipientList, RecipientListMember } = getTenantClientModels(conn)

  const stillUsed = await Campaign.exists({ recipientsListId: id })
  if (stillUsed) return false

  const removed = await RecipientList.deleteOne({ _id: id, campaignAudience: true })
  if (!removed.deletedCount) return false
  await RecipientListMember.deleteMany({ recipientListId: id })
  return true
}
