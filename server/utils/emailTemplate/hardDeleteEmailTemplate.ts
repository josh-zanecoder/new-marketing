import type { Connection } from 'mongoose'
import type { Types } from 'mongoose'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { DELETED_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

export type HardDeleteEmailTemplateResult =
  | { ok: true; campaignsCleared: number }
  | { ok: false; reason: 'not_found' | 'not_soft_deleted' }

export async function hardDeleteSoftDeletedEmailTemplate(
  tenantConn: Connection,
  EmailTemplate: EmailTemplateModel,
  templateId: Types.ObjectId | string
): Promise<HardDeleteEmailTemplateResult> {
  const existing = await EmailTemplate.findById(templateId).select('_id deletedAt').lean()
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.deletedAt == null) return { ok: false, reason: 'not_soft_deleted' }

  const { Campaign } = getTenantClientModels(tenantConn)
  const cleared = await Campaign.updateMany(
    { emailTemplate: existing._id },
    { $unset: { emailTemplate: 1 } }
  )
  await EmailTemplate.deleteOne({ _id: existing._id, ...DELETED_EMAIL_TEMPLATE_FILTER })

  return { ok: true, campaignsCleared: cleared.modifiedCount ?? 0 }
}
