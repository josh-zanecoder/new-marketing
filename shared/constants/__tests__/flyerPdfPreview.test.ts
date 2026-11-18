import { describe, expect, it } from 'vitest'
import {
  FLYER_PDF_PREVIEW_JPEG_QUALITY,
  FLYER_PDF_PREVIEW_MAX_WIDTH
} from '../flyerPdfPreview'

describe('flyerPdfPreview', () => {
  it('exposes positive preview limits', () => {
    expect(FLYER_PDF_PREVIEW_MAX_WIDTH).toBeGreaterThan(0)
    expect(FLYER_PDF_PREVIEW_JPEG_QUALITY).toBeGreaterThan(0)
    expect(FLYER_PDF_PREVIEW_JPEG_QUALITY).toBeLessThanOrEqual(1)
  })
})
