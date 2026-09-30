/** Inbox snippet length. Longer text is cut so clients do not spill into the body. */
export const EMAIL_PREVIEW_TEXT_MAX = 150

const PREVIEW_MARKER = 'data-email-preview-text="1"'

export function normalizeEmailPreviewText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, EMAIL_PREVIEW_TEXT_MAX)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Hidden preheader plus padding so inbox clients use this line, not the email body. */
export function emailPreviewTextPreheaderHtml(previewText: string): string {
  const text = normalizeEmailPreviewText(previewText)
  if (!text) return ''
  const pad = '&zwnj;&nbsp;'.repeat(48)
  return (
    `<div ${PREVIEW_MARKER} style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">` +
    `${escapeHtml(text)}</div>` +
    `<div style="display:none;max-height:0;overflow:hidden;">${pad}</div>`
  )
}

/** Inserts preview text at the start of the message. Leaves HTML unchanged when the text is empty. */
export function applyEmailPreviewText(html: string, previewText: string): string {
  const snippet = emailPreviewTextPreheaderHtml(previewText)
  if (!snippet) return html
  const source = String(html ?? '')
  if (source.includes(PREVIEW_MARKER)) return source
  const bodyOpen = source.match(/<body\b[^>]*>/i)
  if (bodyOpen && bodyOpen.index != null) {
    const at = bodyOpen.index + bodyOpen[0].length
    return source.slice(0, at) + snippet + source.slice(at)
  }
  return snippet + source
}
