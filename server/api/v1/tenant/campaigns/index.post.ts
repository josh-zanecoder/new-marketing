import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { ManualRecipientInsert, ManualRecipientInsertManyCast, ManualRecipientModel } from '../../../../types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { resolveRecipientListEmails } from '../../../../utils/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '../../../../utils/emailMerge/tenantUserFromAuth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    senderName: string
    senderEmail: string
    subject: string
    recipientsType?: 'manual' | 'list'
    recipientsListId?: string
    recipientsManual?: string[]
    templateHtml?: string
  }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: 'Campaign name is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient } = getTenantClientModels(conn)

  let emailTemplateId: string | undefined

  if (body.templateHtml) {
    const template = await new EmailTemplate({
      name: `${body.name} - Template`,
      subject: body.subject?.trim() || body.name.trim(),
      htmlTemplate: body.templateHtml
    }).save()
    emailTemplateId = template._id.toString()
  }

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''

  const mergeSnap = tenantUserFieldsFromAuth(event.context.auth)
  const campaignData: Record<string, unknown> = {
    name: body.name.trim(),
    sender: {
      name: body.senderName?.trim() || 'Mortdash',
      email: body.senderEmail?.trim() || 'joshdanielsaraa@gmail.com'
    },
    recipientsType,
    recipientsListId,
    subject: body.subject?.trim() || '',
    status: 'Draft',
    clientId: ''
  }
  if (emailTemplateId) campaignData.emailTemplate = emailTemplateId
  if (mergeSnap) campaignData.mergeUserSnapshot = mergeSnap

  const campaign = await new Campaign(campaignData).save()

  if (recipientsType === 'manual' && body.recipientsManual?.length) {
    const raw = (body.recipientsManual || [])
      .map((e) => e?.trim?.().toLowerCase())
      .filter((e): e is string => !!e && e.includes('@'))
    const emails = [...new Set(raw)]
    if (emails.length) {
      const docs: ManualRecipientInsert[] = emails.map((email) => ({
        campaign: campaign._id,
        email,
        clientId: ''
      }))
      await (ManualRecipient as ManualRecipientModel).insertMany(
        docs as unknown as ManualRecipientInsertManyCast[]
      )
    }
  } else if (recipientsType === 'list' && recipientsListId) {
    const emails = await resolveRecipientListEmails(conn, recipientsListId)
    if (emails.length) {
      const docs: ManualRecipientInsert[] = emails.map((email) => ({
        campaign: campaign._id,
        email,
        clientId: ''
      }))
      await (ManualRecipient as ManualRecipientModel).insertMany(
        docs as unknown as ManualRecipientInsertManyCast[]
      )
    }
  }

  return { id: String(campaign._id), campaign }
})
