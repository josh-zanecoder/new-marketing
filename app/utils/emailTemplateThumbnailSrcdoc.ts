/** Fixed layout width for email HTML in card thumbnails (standard ~600px emails). */
export const EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH = 600

export function emailTemplateThumbnailSrcdoc(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f8f4ef;overflow:visible}
#preview-wrap{width:${EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH}px;max-width:${EMAIL_TEMPLATE_THUMB_LAYOUT_WIDTH}px;margin:0 auto;overflow:visible}
#preview-wrap img{max-width:100%!important;height:auto!important}
#preview-wrap table{max-width:100%!important}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}
