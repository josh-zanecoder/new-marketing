import { Campaign } from '../../../models/Campaign'
import { EmailTemplate } from '../../../models/EmailTemplate'
import { ManualRecipient } from '../../../models/ManualRecipients'
import type { CampaignLean, CampaignModel } from '../../../types/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../../../types/emailTemplate.model'
import type {
  ManualRecipientInsert,
  ManualRecipientInsertManyCast,
  ManualRecipientLean,
  ManualRecipientModel
} from '../../../types/manualRecipient.model'
import { getRegistryConnection } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  await getRegistryConnection()

  const source = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!source) throw createError({ statusCode: 404, message: 'Campaign not found' })

  let emailTemplateId: string | undefined
  if (source.emailTemplate) {
    const template = await (EmailTemplate as EmailTemplateModel)
      .findById(source.emailTemplate)
      .lean<EmailTemplateDoc | null>()
    if (template) {
      const newTemplate = await new EmailTemplate({
        name: `${source.name} (copy) - Template`,
        html: template.html,
        clientId: ''
      }).save()
      emailTemplateId = newTemplate._id.toString()
    }
  }

  const newCampaign = await new Campaign({
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
    const manualRecipients = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: source._id })
      .lean<ManualRecipientLean[]>()
    const emails = [
      ...new Set(
        manualRecipients
          .map((r) => r.email?.trim?.().toLowerCase())
          .filter((e): e is string => !!e && e.includes('@'))
      )
    ]
    if (emails.length) {
      const docs: ManualRecipientInsert[] = emails.map((email) => ({
        campaign: newCampaign._id,
        email,
        clientId: ''
      }))
      await (ManualRecipient as ManualRecipientModel).insertMany(
        docs as unknown as ManualRecipientInsertManyCast[]
      )
    }
  }

  return { id: newCampaign._id.toString(), campaign: newCampaign }
})
