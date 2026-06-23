import { isEmailHtmlDocument } from './emailEditorHtml'

const PREVIEW_CHROME_STYLE = `*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:#f8f4ef}`

/**
 * Build iframe `srcdoc` for email previews.
 * Full HTML documents are passed through (with optional chrome); fragments are wrapped.
 */
export function wrapEmailHtmlForPreviewSrcdoc(
  html: string,
  options?: { maxWidth?: number; scrollable?: boolean }
): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  const maxWidth = options?.maxWidth ?? 600
  const scrollable = options?.scrollable ?? false
  const overflow = scrollable ? 'overflow:auto' : 'overflow:hidden'

  if (isEmailHtmlDocument(trimmed)) {
    if (/<head[^>]*>/i.test(trimmed)) {
      return trimmed.replace(
        /<head([^>]*)>/i,
        `<head$1><style>${PREVIEW_CHROME_STYLE}</style>`
      )
    }
    return trimmed
  }

  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
${PREVIEW_CHROME_STYLE}
body{padding:${scrollable ? '20px 12px 28px' : '0'};min-height:100%;${overflow}}
#preview-wrap{width:100%;max-width:${maxWidth}px;margin:0 auto;background:#fff;${scrollable ? 'border-radius:6px;box-shadow:0 8px 30px rgba(15,23,42,.1)' : ''};overflow:hidden}
#preview-wrap img{max-width:100%!important;height:auto!important}
#preview-wrap table{max-width:100%!important}
#preview-wrap td,#preview-wrap th{word-break:break-word}
</style></head><body><div id="preview-wrap">${trimmed}</div></body></html>`
}
