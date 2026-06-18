/** Builds srcdoc for campaign email full-size modal preview (600px card, scrollable). */
export function campaignEmailPreviewSrcdoc(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f8f4ef;overflow:hidden}
body{padding:20px 12px 28px;min-height:100%}
#preview-wrap{width:100%;max-width:600px;margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.1),0 1px 3px rgba(15,23,42,.06)}
#preview-wrap img{max-width:100%!important;height:auto!important}
#preview-wrap table{max-width:100%!important}
#preview-wrap td,#preview-wrap th{word-break:break-word}
</style></head><body><div id="preview-wrap">${html}</div></body></html>`
}
