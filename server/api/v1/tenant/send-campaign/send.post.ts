import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { enqueueCampaignBatch } from '@server/queue/emailQueue'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type {
  CampaignRecipientInsertRow,
  CampaignRecipientModel
} from '@server/types/tenant/campaignRecipient.model'
import { isValidMarketingEmail } from '@server/helpers/marketingEmail'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { recipientEmailsForCampaign } from '@server/utils/emailMerge/campaignAudience'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models

  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

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

  const emails = await recipientEmailsForCampaign(conn, campaign)

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

  const snap = tenantUserFieldsFromAuth(event.context.auth)
  await (Campaign as CampaignModel).updateOne(
    { _id: campaignId },
    {
      $set: {
        status: 'Sending',
        ...(snap ? { mergeUserSnapshot: snap } : {})
      }
    }
  )

  try {
    await enqueueCampaignBatch(campaignId, dbName)
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
