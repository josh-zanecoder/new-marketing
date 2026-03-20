import { Campaign } from '../../../models/Campaign'
import { EmailTemplate } from '../../../models/EmailTemplate'
import { ManualRecipient } from '../../../models/ManualRecipients'

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

  await getRegistryConnection()

  let emailTemplateId: string | undefined

  if (body.templateHtml) {
    const template = await new EmailTemplate({
      name: `${body.name} - Template`,
      html: body.templateHtml,
      clientId: ''
    }).save()
    emailTemplateId = template._id.toString()
  }

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''

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

  const campaign = await new Campaign(campaignData).save()

  if (recipientsType === 'manual' && body.recipientsManual?.length) {
    const raw = (body.recipientsManual || [])
      .map((e) => e?.trim?.().toLowerCase())
      .filter((e): e is string => !!e && e.includes('@'))
    const emails = [...new Set(raw)]
    if (emails.length) {
      await ManualRecipient.insertMany(
        emails.map((email) => ({ campaign: campaign._id, email, clientId: '' })) as any
      )
    }
  }

  return { id: campaign._id.toString(), campaign }
})
