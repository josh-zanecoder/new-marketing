import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import { enqueueCampaignBatch } from '../../../queue/emailQueue'
import type { CampaignLean, CampaignModel } from '../../../types/tenant/campaign.model'
import type {
  CampaignRecipientInsertRow,
  CampaignRecipientModel
} from '../../../types/tenant/campaignRecipient.model'
import type { ManualRecipientLean, ManualRecipientModel } from '../../../types/tenant/manualRecipient.model'
import { isValidMarketingEmail, normalizeMarketingEmail } from '../../../helpers/marketingEmail'
import { getTenantConnectionFromEvent } from '../../../tenant/connection'
import { resolveRecipientListEmails } from '../../../utils/resolveRecipientListEmails'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient, ManualRecipient } = models

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

  let emails: string[] = []
  const manualDocs = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: campaignId })
    .lean<ManualRecipientLean[]>()
  const fromManual = manualDocs
    .map((r) => normalizeMarketingEmail(r.email))
    .filter((e): e is string => !!e)
  emails = [...new Set(fromManual)]

  if (
    !emails.length &&
    campaign.recipientsType === 'list' &&
    campaign.recipientsListId?.trim()
  ) {
    const fromList = await resolveRecipientListEmails(conn, campaign.recipientsListId)
    const normalized = fromList
      .map((e) => normalizeMarketingEmail(e))
      .filter((e): e is string => !!e)
    emails = [...new Set(normalized)]
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
