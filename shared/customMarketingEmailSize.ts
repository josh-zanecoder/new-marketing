/** Gmail clips HTML bodies around this size ([Message clipped]). */
export const GMAIL_CLIP_HTML_BYTES = 102 * 1024

/** Warn before hard clip so senders can shrink images. */
export const CUSTOM_MARKETING_SAFE_HTML_BYTES = 90 * 1024

/** Max source file size accepted before client-side compression. */
export const CUSTOM_MARKETING_MAX_IMAGE_BYTES = 2 * 1024 * 1024

/** Longest edge after resize (keeps photos email-friendly). */
export const CUSTOM_MARKETING_IMAGE_MAX_EDGE = 960

/** JPEG quality used when compressing embedded photos. */
export const CUSTOM_MARKETING_IMAGE_JPEG_QUALITY = 0.72

/** Soft cap for a single compressed image payload (decoded bytes ≈ raw JPEG). */
export const CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES = 48 * 1024

export function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(value ?? '')).length
  }
  return Buffer.byteLength(String(value ?? ''), 'utf8')
}

export function formatByteSizeKb(bytes: number): string {
  const kb = bytes / 1024
  return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)}KB`
}

/** Human warning when Custom Marketing HTML risks Gmail clipping. */
export function customMarketingGmailClipWarning(html: string): string | null {
  const bytes = utf8ByteLength(html)
  if (bytes >= GMAIL_CLIP_HTML_BYTES) {
    return `This email is ${formatByteSizeKb(bytes)}. Gmail clips messages around 102KB — remove or shrink photos so recipients see the full message.`
  }
  if (bytes >= CUSTOM_MARKETING_SAFE_HTML_BYTES) {
    return `This email is ${formatByteSizeKb(bytes)} (Gmail clips near 102KB). Prefer smaller photos to avoid “[Message clipped]”.`
  }
  return null
}

export function isCustomMarketingHtmlOverGmailClip(html: string): boolean {
  return utf8ByteLength(html) >= GMAIL_CLIP_HTML_BYTES
}
