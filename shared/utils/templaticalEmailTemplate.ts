/**
 * Round-trip Templatical JSON inside saved email HTML without a schema change.
 */

export type TemplaticalTemplateContent = {
  blocks?: unknown[]
  settings?: Record<string, unknown>
  [key: string]: unknown
}

const START = '<!--TEMPLATICAL_JSON:'
const END = ':TEMPLATICAL_JSON-->'

function decodeBase64Utf8(payload: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(payload, 'base64').toString('utf8')
  }
  const binary = atob(payload)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeBase64Utf8(text: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf8').toString('base64')
  }
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function packTemplaticalHtml(
  html: string,
  content: TemplaticalTemplateContent
): string {
  const payload = encodeBase64Utf8(JSON.stringify(content))
  const stripped = stripTemplaticalPayload(html).trim()
  return `${START}${payload}${END}\n${stripped}`
}

export function stripTemplaticalPayload(html: string): string {
  const start = html.indexOf(START)
  if (start < 0) return html
  const end = html.indexOf(END, start)
  if (end < 0) return html
  return `${html.slice(0, start)}${html.slice(end + END.length)}`.trim()
}

export function extractTemplaticalContent(
  html: string
): TemplaticalTemplateContent | null {
  const start = html.indexOf(START)
  if (start < 0) return null
  const end = html.indexOf(END, start)
  if (end < 0) return null
  const payload = html.slice(start + START.length, end).trim()
  try {
    const parsed = JSON.parse(decodeBase64Utf8(payload)) as TemplaticalTemplateContent
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
