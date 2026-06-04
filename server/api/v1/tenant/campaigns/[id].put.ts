import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import type { ContactModel } from '@server/types/tenant/contact.model'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type {
  ManualRecipientInsert,
  ManualRecipientInsertManyCast,
  ManualRecipientModel
} from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { resolveRecipientListContactIds } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import {
  isRegisteredTenantAuthContext,
  tenantCreatedByFromAuth
} from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { resolveDefaultCampaignSenderForDbName } from '@server/utils/campaign/resolveDefaultCampaignSender'

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
    templateHtmlSource?: 'editor' | 'upload'
    saveHtmlToLibrary?: boolean
  }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: 'Campaign name is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient, Contact } = getTenantClientModels(conn)

  const campaign = await (Campaign as CampaignModel).findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: id }, event.context.auth)
  )
  if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })
  if (!['Draft', 'Scheduled', 'Sent', 'Failed'].includes(campaign.status)) {
    throw createError({
      statusCode: 400,
      message: 'Only Draft, Scheduled, Sent, or Failed campaigns can be updated'
    })
  }

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''

  const saveToLibrary = body.saveHtmlToLibrary !== false

  if (body.templateHtml && campaign.emailTemplate) {
    const htmlSource =
      body.templateHtmlSource === 'upload' ? 'upload' : 'editor'
    await (EmailTemplate as EmailTemplateModel).updateOne(
      { _id: campaign.emailTemplate },
      {
        $set: {
          htmlTemplate: body.templateHtml,
          htmlSource,
          subject: body.subject?.trim() || campaign.subject || body.name.trim(),
          saveToLibrary
        }
      }
    )
  } else if (body.templateHtml) {
    const htmlSource =
      body.templateHtmlSource === 'upload' ? 'upload' : 'editor'
    const template = await new EmailTemplate({
      name: `${body.name} - Template`,
      subject: body.subject?.trim() || body.name.trim(),
      htmlTemplate: body.templateHtml,
      htmlSource,
      saveToLibrary
    }).save()
    campaign.emailTemplate = template._id
  }

  const auth = event.context.auth
  const registryConn = await getRegistryConnection()
  const dbName =
    isRegisteredTenantAuthContext(auth) && typeof auth.dbName === 'string'
      ? auth.dbName
      : ''
  const senderDefaults = await resolveDefaultCampaignSenderForDbName(registryConn, dbName)

  campaign.name = body.name.trim()
  campaign.sender = {
    name: body.senderName?.trim() || senderDefaults.name,
    email: body.senderEmail?.trim() || senderDefaults.email
  }
  campaign.recipientsType = recipientsType
  campaign.recipientsListId = recipientsListId
  campaign.subject = body.subject?.trim() || ''
  const mergeSnap = tenantUserFieldsFromAuth(event.context.auth)
  if (mergeSnap) campaign.set('mergeUserSnapshot', mergeSnap)
  const editorId = tenantCreatedByFromAuth(event.context.auth)
  if (editorId) campaign.set('updatedBy', editorId)
  await campaign.save()

  if (recipientsType === 'manual') {
    const deleteRecipientsPromise = (ManualRecipient as ManualRecipientModel).deleteMany({
      campaign: campaign._id
    })
    const idStrings = [
      ...new Set(
        (body.recipientsManual || [])
          .map((id) => String(id ?? '').trim())
          .filter((id) => mongoose.isValidObjectId(id))
      )
    ]
    const validatedContactsPromise: Promise<mongoose.Types.ObjectId[]> = idStrings.length
      ? (async () => {
          const objectIds = idStrings.map((cid) => new mongoose.Types.ObjectId(cid))
          const existing = await (Contact as ContactModel)
            .find(withMarketableContactFilter({ _id: { $in: objectIds } }))
            .select('_id')
            .lean<Array<{ _id: mongoose.Types.ObjectId }>>()
          const allowed = new Set(existing.map((d) => String(d._id)))
          return idStrings
            .filter((cid) => allowed.has(cid))
            .map((cid) => new mongoose.Types.ObjectId(cid))
        })()
      : Promise.resolve([])
    const [, contactIds] = await Promise.all([deleteRecipientsPromise, validatedContactsPromise])
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
  } else if (recipientsType === 'list') {
    const deleteRecipientsPromise = (ManualRecipient as ManualRecipientModel).deleteMany({
      campaign: campaign._id
    })
    if (recipientsListId) {
      const [_, contactIds] = await Promise.all([
        deleteRecipientsPromise,
        resolveRecipientListContactIds(conn, recipientsListId)
      ])
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
    } else {
      await deleteRecipientsPromise
    }
  }

  return { id: String(campaign._id), campaign }
})
