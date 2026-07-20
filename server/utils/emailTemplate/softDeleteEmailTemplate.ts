import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'
import type { Types } from 'mongoose'

export async function softDeleteEmailTemplateById(
  EmailTemplate: EmailTemplateModel,
  templateId: Types.ObjectId | string
): Promise<{ matched: boolean; alreadyDeleted: boolean }> {
  const existing = await EmailTemplate.findById(templateId).select('_id deletedAt').lean()
  if (!existing) return { matched: false, alreadyDeleted: false }
  if (existing.deletedAt != null) return { matched: true, alreadyDeleted: true }

  await EmailTemplate.updateOne(
    { _id: templateId, ...ACTIVE_EMAIL_TEMPLATE_FILTER },
    { $set: { deletedAt: new Date() } }
  )
  return { matched: true, alreadyDeleted: false }
}
