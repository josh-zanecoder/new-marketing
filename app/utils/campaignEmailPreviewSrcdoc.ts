/** Builds srcdoc for campaign email iframe previews (full width, no side gutters). */
export function campaignEmailPreviewSrcdoc(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
#preview-wrap{width:100%;max-width:100%;margin:0}
#preview-wrap table{width:100%!important;max-width:100%!important}
#preview-wrap img{max-width:100%;height:auto}
</style></head><body><div id="preview-wrap">${html}</div></body></html>`
}
