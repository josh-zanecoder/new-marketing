import { DEFAULT_UNSUBSCRIBE_MERGE_KEY } from './defaultEmailDynamicVariables'

/** Modal copy when the first-check auto-appends the system footer. */
export const EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_TITLE = 'Unsubscribe footer added'
export const EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_MESSAGE =
  'An unsubscribe footer was added because none was found in the template. You can preview it below or review it at the bottom of the HTML before saving.'
export const EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_CONFIRM = 'Got it'
export const EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_APPENDED_PREVIEW = 'Preview'

/** Marker attribute so we do not append the system footer twice. */
export const EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER = 'data-marketing-unsubscribe-footer'

export const EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER = 'had_placeholder'
export const EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL = 'had_unsubscribe_url'
export const EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED = 'footer_appended'

export type EmailTemplateUnsubscribeCheckStatus =
  | typeof EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER
  | typeof EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL
  | typeof EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED

/** Mustache token matched at save time (whitespace-tolerant). */
export const EMAIL_TEMPLATE_UNSUBSCRIBE_PLACEHOLDER_RE = /\{\{\s*unsubscribe\s*\}\}/i

/** href="/…unsubscribe…" or similar — treats existing unsubscribe URLs as valid. */
export const EMAIL_TEMPLATE_UNSUBSCRIBE_HREF_RE =
  /href\s*=\s*(["'])[^"']*unsubscribe[^"']*\1/i

/** Bare http(s) unsubscribe URLs outside a strict href match. */
export const EMAIL_TEMPLATE_UNSUBSCRIBE_BARE_URL_RE =
  /https?:\/\/[^\s"'<>]*unsubscribe[^\s"'<>]*/i

/** Standard footer appended when neither placeholder nor unsubscribe URL is present. */
export function buildEmailTemplateUnsubscribeFooterHtml(): string {
  const href = `{{${DEFAULT_UNSUBSCRIBE_MERGE_KEY}}}`
  return [
    `<div ${EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER}="1" style="margin-top:24px;padding:16px 12px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#666666;">`,
    `<p style="margin:0;">If you no longer wish to receive these emails, you can <a href="${href}" style="color:#666666;text-decoration:underline;">unsubscribe</a>.</p>`,
    `</div>`
  ].join('')
}
