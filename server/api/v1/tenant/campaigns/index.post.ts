import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactModel } from '@server/types/tenant/contact.model'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import type { ManualRecipientInsert, ManualRecipientInsertManyCast, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { assertRecipientListVisible } from '@server/utils/recipient/assertRecipientListVisible'
import { resolveRecipientListContactIdsWithInclusion } from '@server/utils/recipient/resolveRecipientListEmails'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import {
  isRegisteredTenantAuthContext,
  tenantOwnershipFieldsFromAuth
} from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { resolveCampaignSenderForPersistence } from '@server/utils/campaign/campaignSenderFromAuth'
import { isAllowedSelectedCampaignSenderEmail } from '@server/utils/campaign/listCampaignSenderCandidates'
import { resolveDefaultCampaignSenderForDbName } from '@server/utils/campaign/resolveDefaultCampaignSender'
import { resolveCampaignEmailTemplateOnSave } from '@server/utils/emailTemplate/resolveCampaignEmailTemplateOnSave'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { normalizeEmailPreviewText } from '~~/shared/emailPreviewText'
import { CAMPAIGN_SENDER_MODE_SELECTED } from '~~/shared/campaignSenderMode'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name: string
    senderName: string
    senderEmail: string
    /** `selected` only when Edit sender is ON and an LO profile was picked. */
    senderMode?: string
    subject: string
    previewText?: string
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

  const recipientsType = body.recipientsType || 'manual'
  const recipientsListId = body.recipientsListId || ''
  const auth = event.context.auth
  const dbName =
    isRegisteredTenantAuthContext(auth) && typeof auth.dbName === 'string' ? auth.dbName : ''
  const tenantName = isRegisteredTenantAuthContext(auth)
    ? await resolveCustomMarketingTenantFolderName(auth)
    : ''

  if (recipientsType === 'list' && recipientsListId) {
    await assertRecipientListVisible(conn, recipientsListId, auth)
  }

  const templateResult = await resolveCampaignEmailTemplateOnSave(conn, EmailTemplate as EmailTemplateModel, {
    campaignName: body.name.trim(),
    subject: body.subject,
    emailTemplateId: body.emailTemplateId,
    templateHtml: body.templateHtml,
    templateHtmlSource: body.templateHtmlSource,
    saveHtmlToLibrary: body.saveHtmlToLibrary,
    auth,
    tenantName,
    recipientListId: recipientsListId
  })
  const emailTemplateId = templateResult.emailTemplateId

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
            .find(
              mergeTenantOwnerEmailScopeFilter(
                withMarketableContactFilter({ _id: { $in: objectIds } }),
                auth
              )
            )
            .select('_id')
            .lean<Array<{ _id: mongoose.Types.ObjectId }>>()
          const allowed = new Set(existing.map((d) => String(d._id)))
          return manualRecipientIds
            .filter((id) => allowed.has(id))
            .map((id) => new mongoose.Types.ObjectId(id))
        })()
      : recipientsType === 'list' && recipientsListId
        ? resolveRecipientListContactIdsWithInclusion(
            conn,
            recipientsListId,
            // When provided, only these list members are stored for the campaign (list itself unchanged).
            body.recipientsManual
          )
        : Promise.resolve([])

  const registryConn = await getRegistryConnection()
  const senderDefaults = await resolveDefaultCampaignSenderForDbName(registryConn, dbName)
  const resolvedSender = resolveCampaignSenderForPersistence(
    auth,
    senderDefaults,
    {
      senderEmail: body.senderEmail,
      senderName: body.senderName,
      senderMode: body.senderMode
    },
    { allowTenantEditSender: senderDefaults.allowTenantEditSender }
  )
  if (resolvedSender.senderMode === CAMPAIGN_SENDER_MODE_SELECTED) {
    if (!isRegisteredTenantAuthContext(auth)) {
      throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
    }
    const allowed = await isAllowedSelectedCampaignSenderEmail(
      Contact as ContactModel,
      auth,
      resolvedSender.email
    )
    if (!allowed) {
      throw createError({
        statusCode: 400,
        message: 'Sender must be a loan officer profile from the tenant directory'
      })
    }
  }

  const mergeSnap = tenantUserFieldsFromAuth(event.context.auth)
  const campaignData: Record<string, unknown> = {
    name: body.name.trim(),
    sender: { name: resolvedSender.name, email: resolvedSender.email },
    senderMode: resolvedSender.senderMode,
    recipientsType,
    recipientsListId,
    subject: body.subject?.trim() || '',
    previewText: normalizeEmailPreviewText(body.previewText),
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
