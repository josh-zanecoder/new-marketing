import { describe, expect, it } from 'vitest'
import {
  EMAIL_IMAGE_ALIGN_ATTR,
  EMAIL_IMAGE_ALIGN_OPTIONS,
  EMAIL_IMAGE_ALIGNS
} from '../emailImageAlign'

describe('emailImageAlign', () => {
  it('exposes left, center, and right with UI labels', () => {
    expect(EMAIL_IMAGE_ALIGNS).toEqual(['left', 'center', 'right'])
    expect(EMAIL_IMAGE_ALIGN_ATTR).toBe('data-email-image-align')
    expect(EMAIL_IMAGE_ALIGN_OPTIONS.map((option) => option.value)).toEqual([
      ...EMAIL_IMAGE_ALIGNS
    ])
  })
})
