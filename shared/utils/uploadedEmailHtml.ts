/** Max templates staged for one admin bulk upload session (client). */
export const BULK_EMAIL_TEMPLATES_MAX = 100

/**
 * Max templates in a single POST. Kept small so payloads stay under common
 * reverse-proxy body limits (nginx default `client_max_body_size 1m`).
 */
export const BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST = 10

/**
 * Soft byte budget per POST (UTF-16-ish estimate via JSON.stringify length).
 * ~512KB leaves headroom under nginx 1m and typical CDN limits; works the same
 * when marketing is deployed without nginx.
 */
export const BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET = 512_000

/**
 * Reject a single template that alone would likely exceed a 1m proxy limit
 * once JSON-wrapped (name/subject overhead included).
 */
export const BULK_EMAIL_TEMPLATE_MAX_REQUEST_ITEM_BYTES = 900_000

/** Filename → template name: drop extension, leading `123_`, underscores → spaces. */
export function templateNameFromUploadedFileName(fileName: string): string {
  const base = fileName.replace(/\.(html?|htm)$/i, '')
  const withoutId = base.replace(/^\d+_/, '')
  return withoutId.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || base.trim() || 'Untitled template'
}

export type BulkEmailTemplateRequestItem = {
  name: string
  subject: string
  htmlTemplate: string
  description?: string
  categoryId?: string | null
}

/** Approximate serialized size of one template row in the bulk JSON body. */
export function estimateBulkEmailTemplateRequestItemBytes(
  item: BulkEmailTemplateRequestItem
): number {
  try {
    return JSON.stringify(item).length
  } catch {
    return String(item.htmlTemplate ?? '').length + 256
  }
}

/**
 * Split templates into request-sized chunks by count and byte budget so each
 * POST stays under typical nginx/CDN body limits without requiring proxy config.
 */
export function chunkBulkEmailTemplatesForRequests<T extends BulkEmailTemplateRequestItem>(
  templates: T[],
  options?: {
    byteBudget?: number
    maxPerRequest?: number
  }
): T[][] {
  const byteBudget = options?.byteBudget ?? BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET
  const maxPerRequest = options?.maxPerRequest ?? BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST
  const chunks: T[][] = []
  let current: T[] = []
  let currentBytes = 2 // `[]`

  for (const item of templates) {
    const itemBytes = estimateBulkEmailTemplateRequestItemBytes(item)
    const comma = current.length ? 1 : 0
    const nextBytes = currentBytes + comma + itemBytes
    const wouldExceedBudget = current.length > 0 && nextBytes > byteBudget
    const wouldExceedCount = current.length >= maxPerRequest
    if (wouldExceedBudget || wouldExceedCount) {
      chunks.push(current)
      current = []
      currentBytes = 2
    }
    current.push(item)
    currentBytes += (current.length > 1 ? 1 : 0) + itemBytes
  }
  if (current.length) chunks.push(current)
  return chunks
}

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
