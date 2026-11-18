import {
  FLYER_PDF_PREVIEW_JPEG_QUALITY,
  FLYER_PDF_PREVIEW_MAX_WIDTH
} from '~~/shared/constants/flyerPdfPreview'
import { ensureFlyerPdfjsWorker } from '~/utils/ensureFlyerPdfjsWorker'

async function renderPageToJpeg(
  page: {
    getViewport: (params: { scale: number }) => { width: number; height: number }
    render: (params: {
      canvasContext: CanvasRenderingContext2D
      viewport: { width: number; height: number }
    }) => { promise: Promise<void> }
  },
  maxWidth: number,
  quality: number
): Promise<string> {
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / baseViewport.width, 2)
  const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', quality)
}

/** Rasterize every PDF page to JPEG data URLs for the in-app preview (no browser PDF chrome). */
export async function renderFlyerPdfPagesFromBytes(
  bytes: Uint8Array,
  options?: {
    maxWidth?: number
    quality?: number
    onPage?: (pageNumber: number, total: number, dataUrl: string) => void
  }
): Promise<string[]> {
  const pdfjs = await ensureFlyerPdfjsWorker()
  const maxWidth = options?.maxWidth ?? FLYER_PDF_PREVIEW_MAX_WIDTH
  const quality = options?.quality ?? FLYER_PDF_PREVIEW_JPEG_QUALITY
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const pages: string[] = []
  try {
    const total = pdf.numPages
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const dataUrl = await renderPageToJpeg(page, maxWidth, quality)
      pages.push(dataUrl)
      options?.onPage?.(pageNumber, total, dataUrl)
    }
    return pages
  } finally {
    await pdf.destroy()
  }
}
