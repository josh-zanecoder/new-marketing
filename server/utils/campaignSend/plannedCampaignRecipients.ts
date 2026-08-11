import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean } from '@server/types/tenant/campaign.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'

/** Emails targeted by a campaign before send materializes `CampaignRecipient` rows (e.g. Scheduled). */
export async function resolvePlannedCampaignRecipientEmails(
  conn: Connection,
  campaign: Pick<CampaignLean, '_id' | 'recipientsType' | 'recipientsListId'>
): Promise<string[]> {
  const { ManualRecipient, Contact } = getTenantClientModels(conn)
  const campaignId = campaign._id

  if (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list') {
    const docs = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: campaignId })
      .select('contact')
      .lean<ManualRecipientLean[]>()
    const contactIds = docs.map((r) => r.contact).filter(Boolean) as mongoose.Types.ObjectId[]
    const uniqueIds = [...new Set(contactIds.map((cid) => String(cid)))].map(
      (s) => new mongoose.Types.ObjectId(s)
    )
    const contacts =
      uniqueIds.length > 0
        ? await (Contact as ContactModel)
            .find(withMarketableContactFilter({ _id: { $in: uniqueIds } }))
            .select('email')
            .lean<ContactLean[]>()
        : []
    const emailByContactId = new Map<string, string>(
      contacts.map((c) => [String(c._id), (c.email ?? '').trim().toLowerCase()])
    )
    const fromSnapshot = docs
      .map((r) => emailByContactId.get(String(r.contact)) ?? '')
      .filter((email) => email.trim().length > 0)
    if (fromSnapshot.length) return fromSnapshot
  }

  if (
    campaign.recipientsType === 'list' &&
    String(campaign.recipientsListId ?? '').trim()
  ) {
    return resolveRecipientListEmails(conn, String(campaign.recipientsListId))
  }

  return []
}
