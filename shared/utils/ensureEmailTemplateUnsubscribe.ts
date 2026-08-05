import {
  EMAIL_TEMPLATE_UNSUBSCRIBE_BARE_URL_RE,
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED,
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER,
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER,
  EMAIL_TEMPLATE_UNSUBSCRIBE_HREF_RE,
  EMAIL_TEMPLATE_UNSUBSCRIBE_PLACEHOLDER_RE,
  buildEmailTemplateUnsubscribeFooterHtml,
  type EmailTemplateUnsubscribeCheckStatus
} from '../emailTemplateUnsubscribe'

export type EnsureEmailTemplateUnsubscribeResult = {
  html: string
  status: EmailTemplateUnsubscribeCheckStatus
  footerAppended: boolean
}

export function htmlHasUnsubscribePlaceholder(html: string): boolean {
  return EMAIL_TEMPLATE_UNSUBSCRIBE_PLACEHOLDER_RE.test(html)
}

export function htmlHasUnsubscribeUrl(html: string): boolean {
  return (
    EMAIL_TEMPLATE_UNSUBSCRIBE_HREF_RE.test(html) ||
    EMAIL_TEMPLATE_UNSUBSCRIBE_BARE_URL_RE.test(html)
  )
}

export function htmlHasSystemUnsubscribeFooter(html: string): boolean {
  return html.includes(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER)
}

/** Insert footer before `</body>` when present; otherwise append. */
export function appendEmailTemplateUnsubscribeFooter(html: string): string {
  const footer = buildEmailTemplateUnsubscribeFooterHtml()
  const bodyClose = /<\/body>/i
  if (bodyClose.test(html)) {
    return html.replace(bodyClose, `${footer}</body>`)
  }
  return `${html.trimEnd()}\n${footer}`
}

/**
 * First check (on save/upload): keep `{{unsubscribe}}` or an existing unsubscribe URL;
 * otherwise append the standard footer so every stored template is safe.
 */
export function ensureEmailTemplateUnsubscribe(html: string): EnsureEmailTemplateUnsubscribeResult {
  const trimmed = String(html ?? '')
  if (htmlHasUnsubscribePlaceholder(trimmed)) {
    return {
      html: trimmed,
      status: EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER,
      footerAppended: false
    }
  }
  if (htmlHasUnsubscribeUrl(trimmed) || htmlHasSystemUnsubscribeFooter(trimmed)) {
    return {
      html: trimmed,
      status: EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL,
      footerAppended: false
    }
  }
  return {
    html: appendEmailTemplateUnsubscribeFooter(trimmed),
    status: EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED,
    footerAppended: true
  }
}
