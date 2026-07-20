import type { Types } from 'mongoose'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { DELETED_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'

export type RecoverEmailTemplateResult =
  | { ok: true; alreadyActive: boolean }
  | { ok: false; reason: 'not_found' }

export async function recoverSoftDeletedEmailTemplate(
  EmailTemplate: EmailTemplateModel,
  templateId: Types.ObjectId | string
): Promise<RecoverEmailTemplateResult> {
  const existing = await EmailTemplate.findById(templateId).select('_id deletedAt').lean()
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.deletedAt == null) return { ok: true, alreadyActive: true }

  await EmailTemplate.updateOne(
    { _id: existing._id, ...DELETED_EMAIL_TEMPLATE_FILTER },
    { $set: { deletedAt: null } }
  )
  return { ok: true, alreadyActive: false }
}
