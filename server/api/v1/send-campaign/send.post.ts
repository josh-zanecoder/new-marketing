import { Campaign } from '../../../models/Campaign'
import { CampaignRecipient } from '../../../models/CampaignRecipient'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { enqueueCampaignBatch } from '../../../queue/emailQueue'
import type { CampaignLean, CampaignModel } from '../../../types/campaign.model'
import type {
  CampaignRecipientInsertRow,
  CampaignRecipientModel
} from '../../../types/campaignRecipient.model'
import type { ManualRecipientLean, ManualRecipientModel } from '../../../types/manualRecipient.model'
import { getRegistryConnection } from '../../../utils/db'
import { isValidMarketingEmail, normalizeMarketingEmail } from '../../../helpers/marketingEmail'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (campaign.status !== 'Draft') {
    throw createError({ statusCode: 400, message: 'Campaign can only be sent when in Draft status' })
  }

  const inFlight = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
    campaign: campaignId,
    status: { $in: ['pending', 'sent'] }
  })
  if (inFlight > 0) {
    throw createError({ statusCode: 400, message: 'Campaign has already been queued for sending' })
  }

  await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })

  let emails: string[] = []
  if (campaign.recipientsType === 'manual') {
    const docs = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: campaignId })
      .lean<ManualRecipientLean[]>()
    const raw = docs.map((r) => normalizeMarketingEmail(r.email)).filter((e): e is string => !!e)
    emails = [...new Set(raw)]
  }
  if (!emails.length) throw createError({ statusCode: 400, message: 'No recipients to send to' })

  const valid: string[] = []
  const invalid: string[] = []
  for (const email of emails) {
    if (isValidMarketingEmail(email)) valid.push(email)
    else invalid.push(email)
  }

  const rows: CampaignRecipientInsertRow[] = [
    ...valid.map(
      (email): CampaignRecipientInsertRow => ({
        campaign: campaignId,
        email,
        status: 'pending',
        clientId: ''
      })
    ),
    ...invalid.map(
      (email): CampaignRecipientInsertRow => ({
        campaign: campaignId,
        email,
        status: 'failed',
        clientId: '',
        error: 'Invalid email address'
      })
    )
  ]

  await (CampaignRecipient as CampaignRecipientModel).insertMany(rows)

  if (valid.length === 0) {
    return {
      ok: true,
      total: emails.length,
      valid: 0,
      invalid: invalid.length,
      queued: 0,
      sent: 0,
      failed: invalid.length,
      pending: 0
    }
  }

  await (Campaign as CampaignModel).updateOne({ _id: campaignId }, { status: 'Sending' })

  try {
    await enqueueCampaignBatch(campaignId)
  } catch (e: unknown) {
    await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })
    await (Campaign as CampaignModel).updateOne({ _id: campaignId }, { status: 'Draft' })
    console.error('[SendCampaign] Failed to enqueue:', e)
    throw createError({ statusCode: 503, message: 'Failed to queue campaign emails. Try again.' })
  }

  return {
    ok: true,
    total: emails.length,
    valid: valid.length,
    invalid: invalid.length,
    queued: valid.length,
    sent: 0,
    failed: invalid.length,
    pending: valid.length
  }
})
