import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type {
  ManualRecipientInsert,
  ManualRecipientInsertManyCast,
  ManualRecipientLean,
  ManualRecipientModel
} from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'

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
      const htmlBody = template.htmlTemplate ?? template.html
      const newTemplate = await new EmailTemplate({
        name: `${source.name} (copy) - Template`,
        subject: template.subject?.trim() || source.subject || `${source.name} (copy)`,
        htmlTemplate: htmlBody
      }).save()
      emailTemplateId = newTemplate._id.toString()
    }
  }

  const mergeSnap =
    tenantUserFieldsFromAuth(event.context.auth) ?? source.mergeUserSnapshot

  const newCampaign = await new Campaign({
    name: `${source.name} (copy)`,
    sender: source.sender,
    recipientsType: source.recipientsType,
    recipientsListId: source.recipientsListId || '',
    emailTemplate: emailTemplateId,
    subject: source.subject || '',
    status: 'Draft',
    clientId: '',
    ...(mergeSnap ? { mergeUserSnapshot: mergeSnap } : {})
  }).save()

  if (source.recipientsType === 'manual' || source.recipientsType === 'list') {
    const manualRecipients = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: source._id })
      .lean<ManualRecipientLean[]>()
    let emails = [
      ...new Set(
        manualRecipients
          .map((r) => r.email?.trim?.().toLowerCase())
          .filter((e): e is string => !!e && e.includes('@'))
      )
    ]
    if (
      !emails.length &&
      source.recipientsType === 'list' &&
      String(source.recipientsListId ?? '').trim()
    ) {
      emails = await resolveRecipientListEmails(conn, String(source.recipientsListId))
    }
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
