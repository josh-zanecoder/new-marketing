import { applyCampaignEmailWebhook } from '@server/services/campaignTracking'
import { parseBrevoTransactionalWebhookPayload } from '@server/utils/brevo/parseBrevoTransactionalWebhookPayload'
import { verifyBrevoWebhookSecret } from '@server/utils/brevo/verifyBrevoWebhookSecret'

export default defineEventHandler(async (event) => {
  const auth = verifyBrevoWebhookSecret(event)
  if (!auth.ok) {
    throw createError({ statusCode: auth.statusCode, message: auth.message })
  }

  const body = await readBody(event).catch(() => null)
  const parsed = parseBrevoTransactionalWebhookPayload(body)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Could not parse Brevo webhook payload' })
  }

  const result = await applyCampaignEmailWebhook(parsed)
  if (!result.applied) {
    throw createError({ statusCode: 404, message: 'No campaign routing for this message id' })
  }

  return {
    success: true,
    duplicate: result.duplicate === true,
    dbName: result.dbName,
    campaignId: result.campaignId,
    event: parsed.event
  }
})
