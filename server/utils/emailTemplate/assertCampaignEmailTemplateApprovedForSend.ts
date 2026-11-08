import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { getRegistryConnection } from '@server/lib/mongoose'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import {
  isEmailTemplateSendableStatus,
  resolveEmailTemplateApprovalStatus
} from '~~/shared/emailTemplateApproval'
import {
  canApproveEmailTemplates,
  isEmailTemplateApprovalEnabled
} from '@server/utils/emailTemplate/emailTemplateApproval'

export const EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE =
  'This template needs approval before it can be sent.'

async function isLoRecipientListsFlagOn(auth: unknown, dbName: string): Promise<boolean> {
  if (isEmailTemplateApprovalEnabled(auth)) return true
  if (!dbName) return false
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantLoRecipientLists: 1 } }
  )
  return parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)
}

/**
 * When LO recipient-lists flag is ON, the campaign's linked email template must be approved.
 * OM/Marketing (approvers) may send with a pending template.
 * Flag OFF / no linked template → no-op (classic behavior).
 */
export async function assertCampaignEmailTemplateApprovedForSend(params: {
  conn: Connection
  campaignId: string
  auth?: unknown
  /** Preloaded campaign lean doc (avoids a second fetch). */
  campaign?: Pick<CampaignLean, 'emailTemplate'> | null
}): Promise<void> {
  const dbName = params.conn.db?.databaseName ?? ''
  const enabled = await isLoRecipientListsFlagOn(params.auth, dbName)
  if (!enabled) return
  // Approvers (Marketing / OM) can make campaign + send while still pending.
  // Treat flag as ON here even if session omitted it (registry already confirmed).
  if (
    canApproveEmailTemplates(
      params.auth && typeof params.auth === 'object'
        ? { ...(params.auth as object), allowTenantLoRecipientLists: true as const }
        : params.auth
    )
  ) {
    return
  }

  let emailTemplateRef = params.campaign?.emailTemplate
  if (emailTemplateRef == null) {
    const { Campaign } = getTenantClientModels(params.conn)
    const campaign = await (Campaign as CampaignModel)
      .findById(params.campaignId)
      .select('emailTemplate')
      .lean<Pick<CampaignLean, 'emailTemplate'> | null>()
    emailTemplateRef = campaign?.emailTemplate
  }

  if (!emailTemplateRef) return

  const templateId = String(emailTemplateRef)
  if (!mongoose.isValidObjectId(templateId)) return

  const { EmailTemplate } = getTenantClientModels(params.conn)
  const template = await (EmailTemplate as EmailTemplateModel)
    .findById(templateId)
    .select('approvalStatus')
    .lean<Pick<EmailTemplateDoc, 'approvalStatus'> | null>()

  if (!template) {
    throw createError({
      statusCode: 400,
      message: 'Campaign email template was not found'
    })
  }

  if (!isEmailTemplateSendableStatus(template.approvalStatus)) {
    const status = resolveEmailTemplateApprovalStatus(template.approvalStatus)
    throw createError({
      statusCode: 403,
      message: EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE,
      data: {
        message: EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE,
        approvalStatus: status,
        emailTemplateId: templateId
      }
    })
  }
}

/** Direct template-id check (e.g. test send with an explicit library template). */
export async function assertEmailTemplateApprovedForSend(params: {
  conn: Connection
  emailTemplateId: string
  auth?: unknown
}): Promise<void> {
  const dbName = params.conn.db?.databaseName ?? ''
  const enabled = await isLoRecipientListsFlagOn(params.auth, dbName)
  if (!enabled) return
  if (
    canApproveEmailTemplates(
      params.auth && typeof params.auth === 'object'
        ? { ...(params.auth as object), allowTenantLoRecipientLists: true as const }
        : params.auth
    )
  ) {
    return
  }

  const templateId = String(params.emailTemplateId ?? '').trim()
  if (!templateId || !mongoose.isValidObjectId(templateId)) return

  const { EmailTemplate } = getTenantClientModels(params.conn)
  const template = await (EmailTemplate as EmailTemplateModel)
    .findById(templateId)
    .select('approvalStatus')
    .lean<Pick<EmailTemplateDoc, 'approvalStatus'> | null>()

  if (!template) {
    throw createError({ statusCode: 400, message: 'Email template was not found' })
  }

  if (!isEmailTemplateSendableStatus(template.approvalStatus)) {
    const status = resolveEmailTemplateApprovalStatus(template.approvalStatus)
    throw createError({
      statusCode: 403,
      message: EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE,
      data: {
        message: EMAIL_TEMPLATE_NOT_APPROVED_SEND_MESSAGE,
        approvalStatus: status,
        emailTemplateId: templateId
      }
    })
  }
}
