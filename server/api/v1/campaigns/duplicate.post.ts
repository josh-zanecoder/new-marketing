import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { EmailTemplate } from '../../../models/EmailTemplate'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  const source = await (Campaign as Model<any>).findById(campaignId).lean() as any
  if (!source) throw createError({ statusCode: 404, message: 'Campaign not found' })

  let emailTemplateId: string | undefined
  if (source.emailTemplate) {
    const template = await (EmailTemplate as Model<any>).findById(source.emailTemplate).lean() as any
    if (template) {
      const newTemplate = await new EmailTemplate({
        name: `${source.name} (copy) - Template`,
        html: template.html,
        clientId: ''
      }).save()
      emailTemplateId = newTemplate._id.toString()
    }
  }

  const newCampaign = await new (Campaign as Model<any>)({
    name: `${source.name} (copy)`,
    sender: source.sender,
    recipientsType: source.recipientsType,
    recipientsListId: source.recipientsListId || '',
    emailTemplate: emailTemplateId,
    subject: source.subject || '',
    status: 'Draft',
    clientId: ''
  }).save()

  if (source.recipientsType === 'manual') {
    const manualRecipients = await (ManualRecipient as Model<any>).find({ campaign: source._id }).lean() as any[]
    const emails = [...new Set(manualRecipients.map((r) => r.email?.trim?.().toLowerCase()).filter((e): e is string => !!e && e.includes('@')))]
    if (emails.length) {
      await (ManualRecipient as Model<any>).insertMany(
        emails.map((email) => ({ campaign: newCampaign._id, email, clientId: '' })) as any
      )
    }
  }

  return { id: newCampaign._id.toString(), campaign: newCampaign }
})
