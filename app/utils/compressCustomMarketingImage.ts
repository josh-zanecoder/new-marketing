import {
  CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES,
  CUSTOM_MARKETING_IMAGE_JPEG_QUALITY,
  CUSTOM_MARKETING_IMAGE_MAX_EDGE,
  CUSTOM_MARKETING_MAX_IMAGE_BYTES
} from '~~/shared/customMarketingEmailSize'
import { isAllowedCustomMarketingImageMime } from '~~/shared/customMarketingEditorOptions'

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image.'))
    img.src = src
  })
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality)
}

function dataUrlPayloadBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const b64 = dataUrl.slice(comma + 1)
  return Math.floor((b64.length * 3) / 4)
}

/**
 * Resize + JPEG-compress a photo before GCS upload.
 * Keeps uploads small; email HTML uses the hosted HTTPS URL (not base64).
 */
export async function compressCustomMarketingImageFile(file: File): Promise<string> {
  if (!isAllowedCustomMarketingImageMime(file.type)) {
    throw new Error('Use PNG, JPEG, GIF, or WebP images.')
  }
  if (file.size > CUSTOM_MARKETING_MAX_IMAGE_BYTES) {
    throw new Error('Image must be 2MB or smaller before compression.')
  }
  if (typeof document === 'undefined') {
    throw new Error('Image compression is only available in the browser.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(objectUrl)
    const scale = Math.min(1, CUSTOM_MARKETING_IMAGE_MAX_EDGE / Math.max(img.width, img.height, 1))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not compress image.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    let quality = CUSTOM_MARKETING_IMAGE_JPEG_QUALITY
    let dataUrl = canvasToJpegDataUrl(canvas, quality)
    while (
      dataUrlPayloadBytes(dataUrl) > CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES
      && quality > 0.4
    ) {
      quality -= 0.08
      dataUrl = canvasToJpegDataUrl(canvas, quality)
    }
    if (dataUrlPayloadBytes(dataUrl) > CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES * 1.35) {
      throw new Error('Photo is still too large after compression. Try a smaller image.')
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
