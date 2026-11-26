import { describe, expect, it } from 'vitest'
import { parseAllowTenantAdvancedRecipientFiltering } from './allowTenantAdvancedRecipientFiltering'

describe('parseAllowTenantAdvancedRecipientFiltering', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantAdvancedRecipientFiltering(undefined)).toBe(false)
    expect(parseAllowTenantAdvancedRecipientFiltering(null)).toBe(false)
    expect(parseAllowTenantAdvancedRecipientFiltering('true')).toBe(false)
    expect(parseAllowTenantAdvancedRecipientFiltering(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantAdvancedRecipientFiltering(true)).toBe(true)
    expect(parseAllowTenantAdvancedRecipientFiltering(false)).toBe(false)
  })
})
