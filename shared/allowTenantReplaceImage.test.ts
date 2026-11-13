import { describe, expect, it } from 'vitest'
import {
  hasStoredAllowTenantReplaceImage,
  parseAllowTenantReplaceImage,
  pinAllowTenantReplaceImage
} from './allowTenantReplaceImage'

describe('parseAllowTenantReplaceImage', () => {
  it('uses the stored value when there is one', () => {
    expect(parseAllowTenantReplaceImage({ allowTenantReplaceImage: true })).toBe(true)
    expect(parseAllowTenantReplaceImage({ allowTenantReplaceImage: false, allowTenantInsertImage: true })).toBe(false)
    expect(parseAllowTenantReplaceImage({ allowTenantReplaceImage: true, allowTenantInsertImage: false })).toBe(true)
  })

  it('keeps the old access when nothing is stored yet', () => {
    expect(parseAllowTenantReplaceImage({ allowTenantInsertImage: true })).toBe(true)
    expect(parseAllowTenantReplaceImage({ allowTenantTemplateBuilder: true })).toBe(true)
    expect(parseAllowTenantReplaceImage({ allowTenantInsertImage: false, allowTenantTemplateBuilder: false })).toBe(false)
    expect(parseAllowTenantReplaceImage({ allowTenantReplaceImage: 'true' })).toBe(false)
    expect(parseAllowTenantReplaceImage(null)).toBe(false)
  })

  it('knows when a value has been stored', () => {
    expect(hasStoredAllowTenantReplaceImage({ allowTenantReplaceImage: false })).toBe(true)
    expect(hasStoredAllowTenantReplaceImage({})).toBe(false)
  })

  it('pins the current value before Insert image or the builder changes', () => {
    expect(pinAllowTenantReplaceImage({ allowTenantInsertImage: true })).toEqual({ allowTenantReplaceImage: true })
    expect(pinAllowTenantReplaceImage({})).toEqual({ allowTenantReplaceImage: false })
    expect(pinAllowTenantReplaceImage({ allowTenantReplaceImage: true, allowTenantInsertImage: false })).toEqual({})
  })
})
