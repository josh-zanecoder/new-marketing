import type { Types } from 'mongoose'
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
import { resolveRecipientListContactIds } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import { tenantOwnershipFieldsFromAuth } from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ campaignId: string }>(event)
  const campaignId = body?.campaignId
  if (!campaignId) throw createError({ statusCode: 400, message: 'campaignId is required' })

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient } = getTenantClientModels(conn)

  const source = await (Campaign as CampaignModel)
    .findOne(
      mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, event.context.auth)
    )
    .select(
      '_id name sender recipientsType recipientsListId emailTemplate subject mergeUserSnapshot'
    )
    .lean<CampaignLean | null>()
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

  const ownership = tenantOwnershipFieldsFromAuth(event.context.auth)

  const newCampaign = await new Campaign({
    name: `${source.name} (copy)`,
    sender: source.sender,
    recipientsType: source.recipientsType,
    recipientsListId: source.recipientsListId || '',
    emailTemplate: emailTemplateId,
    subject: source.subject || '',
    status: 'Draft',
    clientId: '',
    ...(mergeSnap ? { mergeUserSnapshot: mergeSnap } : {}),
    ...ownership
  }).save()

  if (source.recipientsType === 'manual' || source.recipientsType === 'list') {
    const manualRecipients = await (ManualRecipient as ManualRecipientModel)
      .find({ campaign: source._id })
      .select('contact')
      .lean<ManualRecipientLean[]>()
    const seen = new Set<string>()
    let contactIds: Types.ObjectId[] = []
    for (const r of manualRecipients) {
      if (!r.contact) continue
      const s = String(r.contact)
      if (seen.has(s)) continue
      seen.add(s)
      contactIds.push(r.contact)
    }
    if (
      !contactIds.length &&
      source.recipientsType === 'list' &&
      String(source.recipientsListId ?? '').trim()
    ) {
      contactIds = await resolveRecipientListContactIds(conn, String(source.recipientsListId))
    }
    if (contactIds.length) {
      const docs: ManualRecipientInsert[] = contactIds.map((contact) => ({
        campaign: newCampaign._id,
        contact,
        clientId: ''
      }))
      await (ManualRecipient as ManualRecipientModel).insertMany(
        docs as unknown as ManualRecipientInsertManyCast[],
        { ordered: false }
      )
    }
  }

  return { id: String(newCampaign._id), campaign: newCampaign }
})
