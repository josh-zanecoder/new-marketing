import type { Model } from 'mongoose'
import { Campaign } from '../../../models/Campaign'
import { EmailTemplate } from '../../../models/EmailTemplate'
import { ManualRecipient } from '../../../models/ManualRecipients'
import { getRegistryConnection } from '../../../utils/db'

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

  await getRegistryConnection()

  const campaign = await (Campaign as Model<any>).findById(id)
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!['Draft', 'Sent', 'Failed'].includes(campaign.status)) {
    throw createError({ statusCode: 400, message: 'Only Draft, Sent, or Failed campaigns can be updated' })
  }

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''

  if (body.templateHtml && campaign.emailTemplate) {
    await (EmailTemplate as Model<any>).updateOne(
      { _id: campaign.emailTemplate },
      { $set: { html: body.templateHtml } }
    )
  } else if (body.templateHtml) {
    const template = await new EmailTemplate({
      name: `${body.name} - Template`,
      html: body.templateHtml,
      clientId: ''
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
  await campaign.save()

  if (recipientsType === 'manual') {
    await (ManualRecipient as Model<any>).deleteMany({ campaign: campaign._id })
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
