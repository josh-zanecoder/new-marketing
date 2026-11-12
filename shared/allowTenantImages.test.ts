import { describe, expect, it } from 'vitest'
import { parseAllowTenantImages } from './allowTenantImages'

describe('parseAllowTenantImages', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantImages(undefined)).toBe(false)
    expect(parseAllowTenantImages(null)).toBe(false)
    expect(parseAllowTenantImages('true')).toBe(false)
    expect(parseAllowTenantImages(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantImages(true)).toBe(true)
    expect(parseAllowTenantImages(false)).toBe(false)
  })
})
