import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientInsert, ManualRecipientInsertManyCast, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { resolveRecipientListContactIds } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import { tenantOwnershipFieldsFromAuth } from '@server/tenant/registry-auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    senderName: string
    senderEmail: string
    subject: string
    recipientsType?: 'manual' | 'list'
    recipientsListId?: string
    /** Contact `_id` strings (manual audience). */
    recipientsManual?: string[]
    templateHtml?: string
  }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: 'Campaign name is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient, Contact } = getTenantClientModels(conn)

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
  const manualRecipientIds = [
    ...new Set(
      (body.recipientsManual || [])
        .map((id) => String(id ?? '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]
  const resolvedRecipientContactsPromise: Promise<mongoose.Types.ObjectId[]> =
    recipientsType === 'manual' && manualRecipientIds.length
      ? (async () => {
          const objectIds = manualRecipientIds.map((id) => new mongoose.Types.ObjectId(id))
          const existing = await (Contact as ContactModel)
            .find({ _id: { $in: objectIds }, deletedAt: null })
            .select('_id')
            .lean<Array<{ _id: mongoose.Types.ObjectId }>>()
          const allowed = new Set(existing.map((d) => String(d._id)))
          return manualRecipientIds
            .filter((id) => allowed.has(id))
            .map((id) => new mongoose.Types.ObjectId(id))
        })()
      : recipientsType === 'list' && recipientsListId
        ? resolveRecipientListContactIds(conn, recipientsListId)
        : Promise.resolve([])

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

  Object.assign(campaignData, tenantOwnershipFieldsFromAuth(event.context.auth))

  const campaign = await new Campaign(campaignData).save()

  if (recipientsType === 'manual' || (recipientsType === 'list' && recipientsListId)) {
    const contactIds = await resolvedRecipientContactsPromise
    if (contactIds.length) {
      const docs: ManualRecipientInsert[] = contactIds.map((contact) => ({
        campaign: campaign._id,
        contact,
        clientId: ''
      }))
      await (ManualRecipient as ManualRecipientModel).insertMany(
        docs as unknown as ManualRecipientInsertManyCast[],
        { ordered: false }
      )
    }
  }

  return { id: String(campaign._id), campaign }
})
