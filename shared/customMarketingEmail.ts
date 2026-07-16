/** Default subject for Custom Marketing (personal-style bulk email). */
export const CUSTOM_MARKETING_DEFAULT_SUBJECT = 'A quick note from {{ user.firstName }}'

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

/**
 * Converts plain email body text into minimal HTML that still reads like a
 * normal personal message (white background, black text, no marketing chrome).
 */
export function plainTextToCustomMarketingHtml(plainBody: string): string {
  const raw = String(plainBody ?? '').replace(/\r\n/g, '\n').trim()
  const paragraphs = raw.length
    ? raw.split(/\n{2,}/).map((block) => {
        const lines = block.split('\n').map((line) => escapeHtmlText(line)).join('<br>\n')
        return `<p style="margin:0 0 1em;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">${lines}</p>`
      })
    : ['<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;"></p>']

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:16px;background:#ffffff;">',
    ...paragraphs,
    '</body></html>'
  ].join('')
}

/** Best-effort reverse of `plainTextToCustomMarketingHtml` for re-editing. */
export function customMarketingHtmlToPlainText(html: string): string {
  const raw = String(html ?? '')
  if (!raw.trim()) return ''
  const withoutTags = raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
  return withoutTags.replace(/\n{3,}/g, '\n\n').trim()
}

export function isCustomMarketingBodyReady(plainBody: string): boolean {
  return String(plainBody ?? '').trim().length > 0
}
