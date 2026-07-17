import { isAllowedCustomMarketingImageMime } from './customMarketingEditorOptions'

export type ParsedCustomMarketingImageDataUrl = {
  mime: string
  base64: string
}

const DATA_IMAGE_SRC_RE = /src\s*=\s*(["'])(data:image\/[^"']+)\1/gi

/** Parse a `data:image/...;base64,...` URL used by TipTap embeds. */
export function parseCustomMarketingImageDataUrl(
  value: string
): ParsedCustomMarketingImageDataUrl | null {
  const raw = String(value ?? '').trim()
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw)
  if (!match) return null
  const mime = String(match[1] ?? '').toLowerCase()
  if (!isAllowedCustomMarketingImageMime(mime)) return null
  const base64 = String(match[2] ?? '').replace(/\s+/g, '')
  if (!base64.length) return null
  return { mime, base64 }
}

/** Unique `data:image/...` src values found in HTML (order preserved). */
export function collectCustomMarketingDataImageSrcs(html: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const source = String(html ?? '')
  DATA_IMAGE_SRC_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = DATA_IMAGE_SRC_RE.exec(source)) !== null) {
    const src = String(match[2] ?? '')
    if (!src || seen.has(src)) continue
    seen.add(src)
    found.push(src)
  }
  return found
}

export function htmlContainsCustomMarketingDataImages(html: string): boolean {
  return collectCustomMarketingDataImageSrcs(html).length > 0
}

/** Replace every occurrence of a data-URL src with a hosted HTTPS URL. */
export function replaceCustomMarketingImageSrc(html: string, fromSrc: string, toSrc: string): string {
  if (!fromSrc || !toSrc) return String(html ?? '')
  return String(html ?? '').split(fromSrc).join(toSrc)
}

export function extensionForCustomMarketingImageMime(mime: string): string {
  const type = String(mime ?? '').toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

/** Sanitize one GCS path segment (tenant name / recipient list id). */
export function sanitizeCustomMarketingGcsPathSegment(value: string, fallback: string): string {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
  return cleaned || fallback
}

/**
 * Object path: `custom-marketing/{tenantName}/{recipientListId|no-list}/{file}`.
 * Uses the registry tenant display name (not Mongo dbName).
 * When no recipient list is selected yet, images go under `no-list`.
 */
export const CUSTOM_MARKETING_GCS_NO_LIST_FOLDER = 'no-list'

export function buildCustomMarketingGcsObjectPath(input: {
  tenantName: string
  recipientListId?: string
  fileName: string
}): string {
  const tenant = sanitizeCustomMarketingGcsPathSegment(input.tenantName, 'tenant')
  const listId = sanitizeCustomMarketingGcsPathSegment(
    input.recipientListId ?? '',
    CUSTOM_MARKETING_GCS_NO_LIST_FOLDER
  )
  const fileName = String(input.fileName ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  const safeFile = fileName || `image-${Date.now()}.jpg`
  return `custom-marketing/${tenant}/${listId}/${safeFile}`
}

/** Public object URL for email clients (Gmail requires HTTPS hosted images, not base64). */
export function buildPublicGcsObjectUrl(bucketName: string, objectPath: string): string {
  const bucket = String(bucketName ?? '').trim()
  const path = String(objectPath ?? '').trim().replace(/^\/+/, '')
  return `https://storage.googleapis.com/${bucket}/${path}`
}
