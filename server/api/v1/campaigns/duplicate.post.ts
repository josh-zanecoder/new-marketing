import { getTenantClientModels } from '../../../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../../../types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../../../types/tenant/emailTemplate.model'
import type {
  ManualRecipientInsert,
  ManualRecipientInsertManyCast,
  ManualRecipientLean,
  ManualRecipientModel
} from '../../../types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '../../../tenant/connection'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient } = getTenantClientModels(conn)

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

  return { id: String(newCampaign._id), campaign: newCampaign }
})
