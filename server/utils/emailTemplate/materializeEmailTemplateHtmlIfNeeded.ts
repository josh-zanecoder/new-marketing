import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import {
  isEmailTemplateHtmlStorageRef,
  resolveStoredEmailTemplateHtml
} from '@server/utils/emailTemplate/resolveStoredEmailTemplateHtml'
import { logger } from '@server/utils/logger'

/**
 * If Mongo still holds a CRM storage URL, fetch HTML and backfill the document.
 */
export async function materializeEmailTemplateHtmlIfNeeded(params: {
  EmailTemplate: EmailTemplateModel
  id: string
  htmlTemplate: string
}): Promise<string> {
  const { EmailTemplate, id, htmlTemplate } = params
  const raw = String(htmlTemplate ?? '').trim()
  if (!isEmailTemplateHtmlStorageRef(raw)) return raw

  try {
    const resolved = await resolveStoredEmailTemplateHtml(raw, { throwOnFetchError: true })
    if (resolved && resolved !== raw) {
      await EmailTemplate.updateOne({ _id: id }, { $set: { htmlTemplate: resolved } })
      return resolved
    }
  } catch (err) {
    logger.warn('Failed to materialize email template HTML from storage ref', {
      id,
      err: err instanceof Error ? err.message : String(err)
    })
  }
  return raw
}
