/** Store pasted/uploaded HTML as-is (trim only). No beautify, parse, or GrapesJS round-trip. */
export function normalizeUploadedEmailHtml(raw: string): string {
  const html = raw.trim()
  if (!html) {
    throw new Error('HTML is empty')
  }
  if (html.length > 2_000_000) {
    throw new Error('HTML file is too large (max 2MB)')
  }
  return html
}

export async function readUploadedHtmlFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.html') && !name.endsWith('.htm') && file.type !== 'text/html') {
    throw new Error('Please choose an .html or .htm file')
  }
  const text = await file.text()
  return normalizeUploadedEmailHtml(text)
}
