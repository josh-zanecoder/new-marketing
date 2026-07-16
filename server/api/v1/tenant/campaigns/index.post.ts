import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientInsert, ManualRecipientInsertManyCast, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { resolveRecipientListContactIds } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import {
  isRegisteredTenantAuthContext,
  tenantOwnershipFieldsFromAuth
} from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { resolveCampaignSenderForPersistence } from '@server/utils/campaign/campaignSenderFromAuth'
import { resolveDefaultCampaignSenderForDbName } from '@server/utils/campaign/resolveDefaultCampaignSender'
import { resolveCampaignEmailTemplateOnSave } from '@server/utils/emailTemplate/resolveCampaignEmailTemplateOnSave'

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
    /** Link an existing library template without creating a duplicate. */
    emailTemplateId?: string
    templateHtml?: string
    templateHtmlSource?: 'editor' | 'upload' | 'custom'
    /** When true, the design also appears in Saved templates. Defaults to false when omitted. */
    saveHtmlToLibrary?: boolean
  }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: 'Campaign name is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Campaign, EmailTemplate, ManualRecipient, Contact } = getTenantClientModels(conn)

  const templateResult = await resolveCampaignEmailTemplateOnSave(conn, EmailTemplate, {
    campaignName: body.name.trim(),
    subject: body.subject,
    emailTemplateId: body.emailTemplateId,
    templateHtml: body.templateHtml,
    templateHtmlSource: body.templateHtmlSource,
    saveHtmlToLibrary: body.saveHtmlToLibrary
  })
  const emailTemplateId = templateResult.emailTemplateId

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
            .find(withMarketableContactFilter({ _id: { $in: objectIds } }))
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

  const auth = event.context.auth
  const registryConn = await getRegistryConnection()
  const dbName =
    isRegisteredTenantAuthContext(auth) && typeof auth.dbName === 'string'
      ? auth.dbName
      : ''
  const senderDefaults = await resolveDefaultCampaignSenderForDbName(registryConn, dbName)
  const sender = resolveCampaignSenderForPersistence(auth, senderDefaults, {
    senderEmail: body.senderEmail
  })

  const mergeSnap = tenantUserFieldsFromAuth(event.context.auth)
  const campaignData: Record<string, unknown> = {
    name: body.name.trim(),
    sender,
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
