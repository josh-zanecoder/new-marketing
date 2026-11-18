import {
  FLYER_PDF_THUMBNAIL_JPEG_QUALITY,
  FLYER_PDF_THUMBNAIL_MAX_WIDTH
} from '~~/shared/constants/flyerPdfThumbnail'
import { ensureFlyerPdfjsWorker } from '~/utils/ensureFlyerPdfjsWorker'

/** Rasterize PDF page 1 from raw bytes into a JPEG data URL for gallery cards. */
export async function renderFlyerPdfThumbnailFromBytes(
  bytes: Uint8Array,
  maxWidth = FLYER_PDF_THUMBNAIL_MAX_WIDTH
): Promise<string> {
  const pdfjs = await ensureFlyerPdfjsWorker()
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  try {
    const page = await pdf.getPage(1)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(maxWidth / baseViewport.width, 2)
    const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    await page.render({
      canvasContext: ctx,
      viewport
    }).promise
    return canvas.toDataURL('image/jpeg', FLYER_PDF_THUMBNAIL_JPEG_QUALITY)
  } finally {
    await pdf.destroy()
  }
}
