import { describe, expect, it } from 'vitest'
import {
  EMAIL_IMAGE_BESIDE_ADD_TO_ROW_LABEL,
  EMAIL_IMAGE_BESIDE_HINT_LABEL,
  EMAIL_IMAGE_BESIDE_ZONE_RATIO,
  EMAIL_IMAGE_ROW_ALIGN,
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_BLOCK_IDS,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_COUNTS,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_ROW_TRAIT,
  EMAIL_IMAGE_ROW_VALIGN,
  EMAIL_IMAGE_WIDTH_TRAIT
} from '../emailImageRow'

describe('emailImageRow constants', () => {
  it('exposes stable row markers and allowed layouts', () => {
    expect(EMAIL_IMAGE_ROW_ATTR).toBe('data-email-image-row')
    expect(EMAIL_IMAGE_ROW_CELL_ATTR).toBe('data-email-image-cell')
    expect(EMAIL_IMAGE_ROW_COUNTS).toEqual([2, 3, 4])
    expect(EMAIL_IMAGE_ROW_ALIGN).toEqual(['left', 'center', 'right'])
    expect(EMAIL_IMAGE_ROW_VALIGN).toEqual(['top', 'middle', 'bottom'])
    expect(EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX).toBe(8)
    expect(EMAIL_IMAGE_ROW_BLOCK_IDS.two).toBe('email-images-2')
    expect(EMAIL_IMAGE_ROW_TRAIT.spacing).toBe('emailImageSpacing')
    expect(EMAIL_IMAGE_WIDTH_TRAIT).toBe('emailWidthPct')
    expect(EMAIL_IMAGE_BESIDE_ZONE_RATIO).toBe(0.5)
    expect(EMAIL_IMAGE_BESIDE_HINT_LABEL).toBe('Side by side')
    expect(EMAIL_IMAGE_BESIDE_ADD_TO_ROW_LABEL).toBe('Add to row')
  })
})
