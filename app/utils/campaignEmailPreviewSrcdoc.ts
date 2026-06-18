/** Builds srcdoc for campaign email iframe previews (full width, scrollable — no downscaling). */
export function campaignEmailPreviewSrcdoc(html: string): string {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{padding:24px 16px 32px;background:#f8f4ef;min-height:100%}
#preview-wrap{width:100%;max-width:600px;margin:0 auto;background:#fff;box-shadow:0 4px 24px rgba(15,23,42,.08)}
</style></head><body><div id="preview-wrap">${html}</div></body></html>`
}
