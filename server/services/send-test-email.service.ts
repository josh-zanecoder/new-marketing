import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { EmailDynamicVariableModel } from '../types/tenant/emailDynamicVariable.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '../types/tenant/emailTemplate.model'
import { isValidMarketingEmail, normalizeMarketingEmail } from '../helpers/marketingEmail'
import { getRegistryConnection } from '../lib/mongoose'
import { findRegistryTenantByDbName } from '../tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '../utils/contactOwnerFilter'
import {
  type DraftRecipientContext,
  previewContactForDraft,
  previewContactForSavedCampaign
} from '../utils/emailMerge/campaignAudience'
import {
  applyDefaultUnsubscribeMergeValue,
  composeEmailMergeRoot,
  fetchEnabledEmailDynamicVariableBindings
} from '../utils/emailMerge/composeMergeRoot'
import {
  mergeUserSnapshotForContact,
  tenantUserFieldsFromAuth
} from '../utils/emailMerge/tenantUserFromAuth'
import {
  buildCampaignCreatorReplyTo,
  buildReplyToFromContactOwner,
  campaignReplyToFromAuth
} from '@server/utils/email/replyToFromContactMetadata'
import { getMarketingPublicBaseUrl } from '@server/utils/marketingPublicBaseUrl'
import { sendEmail } from './brevo.service'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'

export interface SendCampaignTestEmailInput {
  recipient: string
  campaignId?: string
  subject?: string
  senderName?: string
  senderEmail?: string
  templateHtml?: string
  recipientsType?: 'list' | 'manual'
  recipientsListId?: string
  recipientsManual?: string[]
}

export interface SendCampaignTestEmailResult {
  ok: true
  messageId?: string
}

const TEST_SUBJECT_PREFIX = '[Test] '

async function resolveCampaignTemplateHtml(
  EmailTemplate: EmailTemplateModel,
  campaign: CampaignLean
): Promise<string> {
  if (!campaign.emailTemplate) return ''
  const template = await EmailTemplate.findById(campaign.emailTemplate).lean<EmailTemplateDoc | null>()
  if (!template) return ''
  const rawHtml = template.htmlTemplate ?? template.html ?? ''
  if (!rawHtml.trim()) return ''
  return template.css?.trim() ? `<style>${template.css}</style>${rawHtml}` : rawHtml
}

function testSubjectLine(subject: string): string {
  const trimmed = subject.trim() || 'Campaign'
  if (trimmed.toLowerCase().startsWith('[test]')) return trimmed
  return `${TEST_SUBJECT_PREFIX}${trimmed}`
}

async function resolveRegistryMeta(dbName: string): Promise<{
  brevoTenantTagValue: string
  unsubscribeSigningSecret?: string
  crmAppUrl?: string
}> {
  let brevoTenantTagValue = dbName
  let unsubscribeSigningSecret: string | undefined
  let crmAppUrl: string | undefined
  try {
    const registry = await getRegistryConnection()
    const row = await findRegistryTenantByDbName(registry, dbName)
    const tid = row?.tenantId?.trim()
    if (tid) brevoTenantTagValue = tid
    if (row?.clientKeyHash) unsubscribeSigningSecret = row.clientKeyHash
    if (row?.crmAppUrl) crmAppUrl = row.crmAppUrl
  } catch (err) {
    console.warn('[TestEmail] registry lookup failed', { dbName, err })
  }
  return { brevoTenantTagValue, unsubscribeSigningSecret, crmAppUrl }
}

export async function sendCampaignTestEmail(
  conn: Connection,
  auth: unknown,
  input: SendCampaignTestEmailInput
): Promise<SendCampaignTestEmailResult> {
  const recipient = normalizeMarketingEmail(input.recipient)
  if (!isValidMarketingEmail(recipient)) {
    throw createError({ statusCode: 400, message: 'A valid recipient email is required' })
  }

  const dbName = conn.db?.databaseName
  if (!dbName) {
    throw createError({ statusCode: 500, message: 'Tenant connection has no database name' })
  }

  const models = getTenantClientModels(conn)
  const { Campaign, EmailDynamicVariable, EmailTemplate } = models
  const dynamicVariableBindings = await fetchEnabledEmailDynamicVariableBindings(
    EmailDynamicVariable as EmailDynamicVariableModel
  )

  const registryMeta = await resolveRegistryMeta(dbName)
  const marketingBase = getMarketingPublicBaseUrl()
  const previewUnsubscribePlaceholder = registryMeta.crmAppUrl
    ? `${registryMeta.crmAppUrl}/marketing/unsubscribe?token=preview`
    : marketingBase
      ? `${marketingBase}/api/v1/unsubscribe?token=preview`
      : undefined
  const authSnap = tenantUserFieldsFromAuth(auth)

  const campaignId = String(input.campaignId ?? '').trim()
  let subject = ''
  let templateHtml = ''
  let sender = { name: '', email: '' }
  let mergeRoot: Record<string, unknown>
  let replyTo: { email: string; name: string } | undefined
  let campaignTag: string | undefined

  if (campaignId) {
    if (!mongoose.isValidObjectId(campaignId)) {
      throw createError({ statusCode: 400, message: 'Invalid campaignId' })
    }
    const campaign = await (Campaign as CampaignModel)
      .findOne(mergeTenantOwnerEmailScopeFilter({ _id: campaignId }, auth))
      .lean<CampaignLean | null>()
    if (!campaign) throw createError({ statusCode: 404, message: 'Campaign not found' })

    templateHtml = await resolveCampaignTemplateHtml(EmailTemplate as EmailTemplateModel, campaign)
    subject = String(campaign.subject ?? '').trim()
    sender = {
      name: String(campaign.sender?.name ?? '').trim(),
      email: String(campaign.sender?.email ?? '').trim()
    }
    if (!templateHtml) {
      throw createError({ statusCode: 400, message: 'Campaign has no email design' })
    }
    if (!sender.email) {
      throw createError({ statusCode: 400, message: 'Campaign has no sender email' })
    }

    const contact = await previewContactForSavedCampaign(conn, campaignId)
    const userSnapshot = mergeUserSnapshotForContact(contact, campaign.mergeUserSnapshot, authSnap)
    mergeRoot = composeEmailMergeRoot(userSnapshot, contact ?? null, dynamicVariableBindings)
    applyDefaultUnsubscribeMergeValue(mergeRoot, {
      dbName,
      contactId: contact?._id ? String(contact._id) : undefined,
      clientKeyHash: registryMeta.unsubscribeSigningSecret,
      crmAppUrl: registryMeta.crmAppUrl,
      previewPlaceholder: previewUnsubscribePlaceholder
    })
    const creatorReplyTo = buildCampaignCreatorReplyTo(campaign)
    replyTo = buildReplyToFromContactOwner(contact, creatorReplyTo)
    campaignTag = campaignId
  } else {
    templateHtml = String(input.templateHtml ?? '').trim()
    subject = String(input.subject ?? '').trim()
    sender = {
      name: String(input.senderName ?? '').trim(),
      email: String(input.senderEmail ?? '').trim()
    }
    const recipientsType = input.recipientsType
    if (!templateHtml) {
      throw createError({ statusCode: 400, message: 'templateHtml is required for draft test sends' })
    }
    if (!subject) {
      throw createError({ statusCode: 400, message: 'subject is required for draft test sends' })
    }
    if (!sender.email) {
      throw createError({ statusCode: 400, message: 'senderEmail is required for draft test sends' })
    }
    if (recipientsType !== 'list' && recipientsType !== 'manual') {
      throw createError({
        statusCode: 400,
        message: 'recipientsType (list | manual) is required for draft test sends'
      })
    }

    const draft: DraftRecipientContext = {
      recipientsType,
      recipientsListId:
        typeof input.recipientsListId === 'string' ? input.recipientsListId : undefined,
      recipientsManual: Array.isArray(input.recipientsManual)
        ? input.recipientsManual
        : undefined
    }
    const contact = await previewContactForDraft(conn, draft)
    const userSnapshot = mergeUserSnapshotForContact(contact, authSnap)
    mergeRoot = composeEmailMergeRoot(userSnapshot, contact ?? null, dynamicVariableBindings)
    applyDefaultUnsubscribeMergeValue(mergeRoot, {
      dbName,
      contactId: contact?._id ? String(contact._id) : undefined,
      clientKeyHash: registryMeta.unsubscribeSigningSecret,
      crmAppUrl: registryMeta.crmAppUrl,
      previewPlaceholder: previewUnsubscribePlaceholder
    })
    replyTo = campaignReplyToFromAuth(auth)
  }

  const cur = mergeRoot.recipient
  const curObj =
    cur != null && typeof cur === 'object' && !Array.isArray(cur)
      ? (cur as Record<string, unknown>)
      : {}
  if (!String(curObj.email ?? '').trim()) {
    mergeRoot.recipient = { ...curObj, email: recipient }
  }

  const subjectRendered = mergeMustacheTemplate(testSubjectLine(subject), mergeRoot)
  const htmlRendered = mergeMustacheTemplate(templateHtml, mergeRoot)

  const userForTag =
    authSnap?.email?.trim() ||
    [authSnap?.firstName, authSnap?.lastName].filter(Boolean).join(' ').trim() ||
    undefined

  const result = await sendEmail({
    sender: { name: sender.name || sender.email, email: sender.email },
    to: [{ email: recipient }],
    ...(replyTo ? { replyTo } : {}),
    subject: subjectRendered,
    htmlContent: htmlRendered,
    tags: ['test-email', ...(campaignTag ? [`campaign:${campaignTag}`] : [])],
    tenantId: registryMeta.brevoTenantTagValue,
    dbName,
    ...(userForTag ? { user: userForTag } : {})
  })

  if (result.error) {
    throw createError({ statusCode: 502, message: result.error })
  }

  console.log('[TestEmail] sent', { recipient, campaignId: campaignTag, messageId: result.messageId })
  return { ok: true, messageId: result.messageId }
}
