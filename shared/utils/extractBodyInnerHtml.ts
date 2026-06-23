/** Extract body inner HTML without DOMParser (preserves Beefree MSO conditional blocks). */
export function extractBodyInnerHtmlPreserveMarkup(raw: string): string {
  const normalized = raw.trim()
  if (!normalized) return ''

  const bodyMatch = normalized.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch?.[1] != null) {
    return bodyMatch[1].trim()
  }

  if (/<!doctype/i.test(normalized) || /<\s*html[\s>]/i.test(normalized)) {
    return normalized
  }

  return normalized
}
