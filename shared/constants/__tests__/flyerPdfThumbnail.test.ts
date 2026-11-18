import { describe, expect, it } from 'vitest'
import {
  FLYER_PDF_THUMBNAIL_JPEG_QUALITY,
  FLYER_PDF_THUMBNAIL_MAX_WIDTH
} from '../flyerPdfThumbnail'

describe('flyerPdfThumbnail', () => {
  it('exposes positive thumbnail limits', () => {
    expect(FLYER_PDF_THUMBNAIL_MAX_WIDTH).toBeGreaterThan(0)
    expect(FLYER_PDF_THUMBNAIL_JPEG_QUALITY).toBeGreaterThan(0)
    expect(FLYER_PDF_THUMBNAIL_JPEG_QUALITY).toBeLessThanOrEqual(1)
  })
})
