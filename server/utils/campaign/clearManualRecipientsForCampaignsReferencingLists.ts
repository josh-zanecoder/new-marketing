import type { Connection } from 'mongoose'
import type { Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import type { ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'

/**
 * Removes `ManualRecipient` rows for campaigns that still point at one of the given list ids,
 * only when the campaign is still **Draft**.
 *
 * If the campaign already has any other status (`Scheduled`, `Sending`, `Sent`, `Failed`), we
 * do **not** delete manual recipients: the campaign has left “editable draft” and may be queued,
 * in flight, completed, or failed — including per-recipient pending/failed states on
 * `CampaignRecipient`. Those rows are never touched here.
 *
 * Sent / partial-failed details are still shown from `CampaignRecipient` in GET when present;
 * keeping `ManualRecipient` for non-draft avoids stripping data when list metadata is removed.
 */
export async function clearManualRecipientsForCampaignsReferencingLists(
  tenantConn: Connection,
  listIdStrings: string[]
): Promise<number> {
  const unique = [...new Set(listIdStrings.map((s) => String(s ?? '').trim()).filter(Boolean))]
  if (!unique.length) return 0

  const { Campaign, ManualRecipient } = getTenantClientModels(tenantConn)
  /** Only drafts are cleared; any other campaign `status` keeps manual recipient rows. */
  const statusesThatAllowClearingManualRecipients = ['Draft'] as const

  const campaigns = await (Campaign as CampaignModel)
    .find({
      recipientsListId: { $in: unique },
      status: { $in: [...statusesThatAllowClearingManualRecipients] }
    })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>()

  const ids = campaigns.map((c) => c._id)
  if (!ids.length) return 0

  const res = await (ManualRecipient as ManualRecipientModel).deleteMany({
    campaign: { $in: ids }
  })
  return res.deletedCount ?? 0
}
