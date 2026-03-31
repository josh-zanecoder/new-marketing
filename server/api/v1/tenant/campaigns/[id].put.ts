import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { CampaignModel } from '../../../../types/tenant/campaign.model'
import type { EmailTemplateModel } from '../../../../types/tenant/emailTemplate.model'
import type {
  ManualRecipientInsert,
  ManualRecipientInsertManyCast,
  ManualRecipientModel
} from '../../../../types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { resolveRecipientListEmails } from '../../../../utils/resolveRecipientListEmails'
import { mergeUserSnapshotFromTenantAuth } from '../../../../utils/mergeUserSnapshotFromAuth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Campaign ID is required' })

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

  const campaign = await (Campaign as CampaignModel).findById(id)
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!['Draft', 'Sent', 'Failed'].includes(campaign.status)) {
    throw createError({ statusCode: 400, message: 'Only Draft, Sent, or Failed campaigns can be updated' })
  }

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''

  if (body.templateHtml && campaign.emailTemplate) {
    await (EmailTemplate as EmailTemplateModel).updateOne(
      { _id: campaign.emailTemplate },
      {
        $set: {
          htmlTemplate: body.templateHtml,
          subject: body.subject?.trim() || campaign.subject || body.name.trim()
        }
      }
    )
  } else if (body.templateHtml) {
    const template = await new EmailTemplate({
      name: `${body.name} - Template`,
      subject: body.subject?.trim() || body.name.trim(),
      htmlTemplate: body.templateHtml
    }).save()
    campaign.emailTemplate = template._id
  }

  campaign.name = body.name.trim()
  campaign.sender = {
    name: body.senderName?.trim() || 'Mortdash',
    email: body.senderEmail?.trim() || 'joshdanielsaraa@gmail.com'
  }
  campaign.recipientsType = recipientsType
  campaign.recipientsListId = recipientsListId
  campaign.subject = body.subject?.trim() || ''
  const mergeSnap = mergeUserSnapshotFromTenantAuth(event.context.auth)
  if (mergeSnap) campaign.set('mergeUserSnapshot', mergeSnap)
  await campaign.save()

  if (recipientsType === 'manual') {
    await (ManualRecipient as ManualRecipientModel).deleteMany({ campaign: campaign._id })
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
  } else if (recipientsType === 'list') {
    await (ManualRecipient as ManualRecipientModel).deleteMany({ campaign: campaign._id })
    if (recipientsListId) {
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
  }

  return { id: String(campaign._id), campaign }
})
