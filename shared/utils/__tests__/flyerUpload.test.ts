import { describe, expect, it } from 'vitest'
import {
  extensionForFlyerMime,
  isAllowedFlyerMime,
  isFlyerImageMime,
  isFlyerPdfMime,
  normalizeFlyerMime,
  parseFlyerDataUrl
} from '../flyerUpload'

describe('flyerUpload', () => {
  it('normalizes and allows printable flyer MIME types', () => {
    expect(normalizeFlyerMime('image/JPG')).toBe('image/jpeg')
    expect(isAllowedFlyerMime('application/pdf')).toBe(true)
    expect(isAllowedFlyerMime('image/png')).toBe(true)
    expect(isAllowedFlyerMime('text/plain')).toBe(false)
    expect(isFlyerPdfMime('application/pdf')).toBe(true)
    expect(isFlyerImageMime('image/webp')).toBe(true)
  })

  it('maps extensions and parses data URLs', () => {
    expect(extensionForFlyerMime('application/pdf')).toBe('pdf')
    expect(extensionForFlyerMime('image/png')).toBe('png')

    const parsed = parseFlyerDataUrl('data:application/pdf;base64,JVBERi0=')
    expect(parsed).toEqual({ mime: 'application/pdf', base64: 'JVBERi0=' })
    expect(parseFlyerDataUrl('data:text/plain;base64,YQ==')).toBeNull()
  })
})
