import { describe, expect, it } from 'vitest'
import { parseAllowTenantLoRecipientLists } from './allowTenantLoRecipientLists'

describe('parseAllowTenantLoRecipientLists', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantLoRecipientLists(undefined)).toBe(false)
    expect(parseAllowTenantLoRecipientLists(null)).toBe(false)
    expect(parseAllowTenantLoRecipientLists('true')).toBe(false)
    expect(parseAllowTenantLoRecipientLists(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantLoRecipientLists(true)).toBe(true)
    expect(parseAllowTenantLoRecipientLists(false)).toBe(false)
  })
})
