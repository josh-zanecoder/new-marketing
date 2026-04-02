import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, ManualRecipient, Contact } = getTenantClientModels(conn)

  const campaigns = await (Campaign as CampaignModel)
    .find({})
    .sort({ createdAt: -1 })
    .lean<CampaignLean[]>()
  const campaignIds = campaigns.map((c) => c._id)

  const recipientDocs = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: { $in: campaignIds } })
    .lean<ManualRecipientLean[]>()
  const allContactIds = [
    ...new Set(
      recipientDocs.map((r) => String(r.contact)).filter((id) => mongoose.isValidObjectId(id))
    )
  ].map((s) => new mongoose.Types.ObjectId(s))
  const contacts =
    allContactIds.length > 0
      ? await (Contact as ContactModel)
          .find({ _id: { $in: allContactIds }, deletedAt: null })
          .select('email')
          .lean<ContactLean[]>()
      : []
  const emailByContactId = new Map(contacts.map((c) => [String(c._id), (c.email ?? '').trim()]))

  const recipientsByCampaign = new Map<string, { email: string; contactId: string }[]>()
  for (const r of recipientDocs) {
    const id = String(r.campaign)
    if (!recipientsByCampaign.has(id)) recipientsByCampaign.set(id, [])
    const email = emailByContactId.get(String(r.contact)) ?? ''
    if (!email.trim()) continue
    recipientsByCampaign.get(id)!.push({
      email,
      contactId: String(r.contact)
    })
  }

  const campaignsWithRecipients = await Promise.all(
    campaigns.map(async (c) => {
      const id = String(c._id)
      let recipients: { email: string; contactId?: string }[] = []

      if (c.recipientsType === 'list' && String(c.recipientsListId ?? '').trim()) {
        const emails = await resolveRecipientListEmails(conn, String(c.recipientsListId))
        recipients = emails.map((email) => ({ email }))
      } else if (c.recipientsType === 'manual' || c.recipientsType === 'list') {
        recipients = recipientsByCampaign.get(id) || []
      }

      return {
        id,
        name: c.name,
        sender: c.sender,
        recipientsType: c.recipientsType,
        recipientsListId: c.recipientsListId,
        subject: c.subject,
        status: c.status,
        recipients,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }
    })
  )

  return { campaigns: campaignsWithRecipients }
})
