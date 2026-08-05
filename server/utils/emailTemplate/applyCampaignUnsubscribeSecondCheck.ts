import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean } from '@server/types/tenant/campaign.model'
import type { EmailTemplateDoc, EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { materializeEmailTemplateHtmlIfNeeded } from '@server/utils/emailTemplate/materializeEmailTemplateHtmlIfNeeded'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'

export type CampaignUnsubscribeSecondCheckResult = {
  /** Empty when the campaign has no linked template HTML. */
  html: string
  footerAppended: boolean
  templateId: string | null
}

/**
 * Loads the campaign email template once and runs the unsubscribe first-check util.
 * Does not persist — caller decides whether to save and/or pause for approval.
 */
export async function inspectCampaignUnsubscribeSecondCheck(
  conn: Connection,
  campaign: Pick<CampaignLean, 'emailTemplate'>
): Promise<CampaignUnsubscribeSecondCheckResult> {
  const templateId = campaign.emailTemplate ? String(campaign.emailTemplate) : ''
  if (!templateId) {
    return { html: '', footerAppended: false, templateId: null }
  }

  const { EmailTemplate } = getTenantClientModels(conn)
  const template = await (EmailTemplate as EmailTemplateModel)
    .findById(templateId)
    .lean<EmailTemplateDoc | null>()
  if (!template) {
    return { html: '', footerAppended: false, templateId: null }
  }

  const rawHtml = await materializeEmailTemplateHtmlIfNeeded({
    EmailTemplate: EmailTemplate as EmailTemplateModel,
    id: templateId,
    htmlTemplate: template.htmlTemplate ?? template.html ?? ''
  })
  if (!rawHtml.trim()) {
    return { html: '', footerAppended: false, templateId }
  }

  const withCss =
    template.css?.trim() ? `<style>${template.css}</style>${rawHtml}` : rawHtml
  const check = ensureEmailTemplateUnsubscribe(withCss)
  return {
    html: check.html,
    footerAppended: check.footerAppended,
    templateId
  }
}

/** Persists HTML after a second-check append (strips a leading injected style block if present). */
export async function persistCampaignTemplateHtmlAfterUnsubscribeCheck(
  conn: Connection,
  templateId: string,
  htmlWithOptionalStyle: string
): Promise<void> {
  const { EmailTemplate } = getTenantClientModels(conn)
  const existing = await (EmailTemplate as EmailTemplateModel)
    .findById(templateId)
    .select('css')
    .lean<{ css?: string } | null>()
  let htmlTemplate = htmlWithOptionalStyle
  const css = existing?.css?.trim()
  if (css) {
    const prefix = `<style>${css}</style>`
    if (htmlTemplate.startsWith(prefix)) {
      htmlTemplate = htmlTemplate.slice(prefix.length)
    }
  }
  await (EmailTemplate as EmailTemplateModel).updateOne(
    { _id: templateId },
    { $set: { htmlTemplate } }
  )
}
