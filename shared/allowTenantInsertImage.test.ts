import { describe, expect, it } from 'vitest'
import { parseAllowTenantInsertImage } from './allowTenantInsertImage'

describe('parseAllowTenantInsertImage', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantInsertImage(undefined)).toBe(false)
    expect(parseAllowTenantInsertImage(null)).toBe(false)
    expect(parseAllowTenantInsertImage('true')).toBe(false)
    expect(parseAllowTenantInsertImage(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantInsertImage(true)).toBe(true)
    expect(parseAllowTenantInsertImage(false)).toBe(false)
  })
})
