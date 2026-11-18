import {
  FLYER_ALLOWED_MIME_TYPES,
  FLYER_MAX_FILE_BYTES,
  type FlyerAllowedMimeType
} from '../constants/flyerUpload'

export type ParsedFlyerDataUrl = {
  mime: FlyerAllowedMimeType
  base64: string
}

const ALLOWED_SET = new Set<string>(
  FLYER_ALLOWED_MIME_TYPES.map((mime) => mime.toLowerCase())
)

/** Normalize `image/jpg` → `image/jpeg` for storage. */
export function normalizeFlyerMime(raw: string): string {
  const mime = String(raw ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    ?.trim() || ''
  if (mime === 'image/jpg') return 'image/jpeg'
  return mime
}

export function isAllowedFlyerMime(mime: string): mime is FlyerAllowedMimeType {
  return ALLOWED_SET.has(normalizeFlyerMime(mime))
}

export function isFlyerImageMime(mime: string): boolean {
  return normalizeFlyerMime(mime).startsWith('image/')
}

export function isFlyerPdfMime(mime: string): boolean {
  return normalizeFlyerMime(mime) === 'application/pdf'
}

export function extensionForFlyerMime(mime: string): string {
  const type = normalizeFlyerMime(mime)
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

/** Parse a `data:<mime>;base64,...` flyer payload. */
export function parseFlyerDataUrl(value: string): ParsedFlyerDataUrl | null {
  const raw = String(value ?? '').trim()
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw)
  if (!match) return null
  const mime = normalizeFlyerMime(String(match[1] ?? ''))
  if (!isAllowedFlyerMime(mime)) return null
  const base64 = String(match[2] ?? '').replace(/\s+/g, '')
  if (!base64.length) return null
  return { mime, base64 }
}

export function flyerDataUrlByteLength(base64: string): number {
  return Math.floor((String(base64 ?? '').length * 3) / 4)
}

export function assertFlyerFileWithinLimit(byteLength: number): void {
  if (byteLength <= 0) {
    throw new Error('File is empty.')
  }
  if (byteLength > FLYER_MAX_FILE_BYTES) {
    throw new Error('File is too large. Use a PDF or image under 15MB.')
  }
}
