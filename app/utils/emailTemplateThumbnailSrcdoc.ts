/** Fixed layout width for email HTML in card thumbnails (standard ~600px emails). */
export const EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH = 600

/** Wide enough that campaign previews keep the desktop email instead of the stacked layout. */
export const CAMPAIGN_EMAIL_PREVIEW_LAYOUT_WIDTH = 960

export function emailTemplateThumbnailSrcdoc(html: string, layoutWidth = EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH): string {
  const width = Math.max(320, Math.round(layoutWidth))
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f8f4ef;overflow:hidden}
#preview-wrap{width:${width}px;max-width:${width}px;margin:0 auto;overflow:hidden;background:#fff;box-shadow:0 4px 24px rgba(15,23,42,.08)}
#preview-wrap img{max-width:100%!important;height:auto!important}
#preview-wrap table{max-width:100%!important}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}
