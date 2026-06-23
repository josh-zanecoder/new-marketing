/** Keep imported full HTML documents verbatim for browser-accurate preview. */
export function storeImportedFullDocumentHtml(raw: string): string {
  return raw.trim()
}

/** Replace only the body inner HTML — preserves <head>, xmlns, MSO comments, etc. */
export function replaceDocumentBodyInnerHtml(fullHtml: string, bodyInnerHtml: string): string {
  const trimmed = fullHtml.trim()
  if (!/<body\b/i.test(trimmed)) {
    return trimmed
  }
  return trimmed.replace(/<body\b[^>]*>[\s\S]*<\/body>/i, (match) => {
    const bodyOpen = match.match(/<body\b[^>]*>/i)?.[0] ?? '<body>'
    return `${bodyOpen}${bodyInnerHtml}</body>`
  })
}

export function isFullHtmlDocumentString(html: string): boolean {
  const trimmed = html.trim()
  return /^<!doctype html>/i.test(trimmed) || /<\s*html[\s>]/i.test(trimmed)
}
