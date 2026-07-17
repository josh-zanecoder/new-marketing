/** Default subject for Custom Marketing (personal-style bulk email). */
export const CUSTOM_MARKETING_DEFAULT_SUBJECT = 'A quick note from {{ recipient.firstName }}'

/** Default plain-text body — looks like a normal personal email, not a marketing blast. */
export const CUSTOM_MARKETING_DEFAULT_BODY = [
  'Dear {{ recipient.firstName }},',
  '',
  'I wanted to reach out personally with a quick update.',
  '',
  'Please let me know if you have any questions — I am happy to help.',
  '',
  'Best regards,',
  '{{ user.firstName }} {{ user.lastName }}'
].join('\n')

export function escapeHtmlText(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Strip tags for readiness checks (images still count as content). */
export function stripHtmlToPlainText(html: string): string {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** TipTap-friendly HTML fragment from plain default text. */
export function plainTextToCustomMarketingEditorHtml(plainBody: string): string {
  const raw = String(plainBody ?? '').replace(/\r\n/g, '\n').trim()
  if (!raw.length) return '<p></p>'
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((line) => escapeHtmlText(line)).join('<br>')
      return `<p>${lines}</p>`
    })
    .join('')
}

export const CUSTOM_MARKETING_DEFAULT_BODY_HTML = plainTextToCustomMarketingEditorHtml(
  CUSTOM_MARKETING_DEFAULT_BODY
)

/**
 * Wraps TipTap (or other) HTML fragment in a minimal personal-style email document.
 */
export function wrapCustomMarketingRichHtml(innerHtml: string): string {
  const inner = String(innerHtml ?? '').trim() || '<p></p>'
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:16px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">',
    inner,
    '</body></html>'
  ].join('')
}

/**
 * Converts plain email body text into minimal HTML that still reads like a
 * normal personal message (white background, black text, no marketing chrome).
 */
export function plainTextToCustomMarketingHtml(plainBody: string): string {
  return wrapCustomMarketingRichHtml(plainTextToCustomMarketingEditorHtml(plainBody))
}

/** Best-effort reverse of `plainTextToCustomMarketingHtml` for re-editing. */
export function customMarketingHtmlToPlainText(html: string): string {
  return stripHtmlToPlainText(html)
}

export function isCustomMarketingBodyReady(bodyHtmlOrPlain: string): boolean {
  const raw = String(bodyHtmlOrPlain ?? '').trim()
  if (!raw) return false
  if (/<img\b/i.test(raw)) return true
  return stripHtmlToPlainText(raw).length > 0
}

export type CustomMarketingContentSource = 'write' | 'upload'

/** HTML that will be sent for Custom Marketing (rich compose or uploaded template). */
export function resolveCustomMarketingSendHtml(input: {
  contentSource: CustomMarketingContentSource
  /** TipTap HTML fragment (write mode). Legacy plain text still works via wrap path. */
  bodyHtml: string
  uploadedHtml: string
}): string {
  if (input.contentSource === 'upload') {
    return String(input.uploadedHtml ?? '').trim()
  }
  const raw = String(input.bodyHtml ?? '').trim()
  if (!raw) return wrapCustomMarketingRichHtml('<p></p>')
  if (/^<!DOCTYPE\s+html/i.test(raw) || /^<html[\s>]/i.test(raw)) return raw
  return wrapCustomMarketingRichHtml(raw)
}

export function isCustomMarketingContentReady(input: {
  contentSource: CustomMarketingContentSource
  bodyHtml: string
  uploadedHtml: string
}): boolean {
  if (input.contentSource === 'upload') {
    return String(input.uploadedHtml ?? '').trim().length > 0
  }
  return isCustomMarketingBodyReady(input.bodyHtml)
}
