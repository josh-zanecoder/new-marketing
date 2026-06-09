import { sendCampaignTestEmail } from '@server/services/send-test-email.service'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    recipient?: string
    campaignId?: string
    subject?: string
    senderName?: string
    senderEmail?: string
    templateHtml?: string
    recipientsType?: 'list' | 'manual'
    recipientsListId?: string
    recipientsManual?: string[]
  }>(event)

  const recipient = String(body?.recipient ?? '').trim()
  if (!recipient) throw createError({ statusCode: 400, message: 'recipient is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const campaignId = String(body?.campaignId ?? '').trim()

  return sendCampaignTestEmail(conn, event.context.auth, {
    recipient,
    ...(campaignId ? { campaignId } : {}),
    subject: body?.subject,
    senderName: body?.senderName,
    senderEmail: body?.senderEmail,
    templateHtml: body?.templateHtml,
    recipientsType: body?.recipientsType,
    recipientsListId: body?.recipientsListId,
    recipientsManual: body?.recipientsManual
  })
})
