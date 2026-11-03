import { describe, expect, it } from 'vitest'
import { parseAllowTenantEditSender } from './allowTenantEditSender'

describe('parseAllowTenantEditSender', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantEditSender(undefined)).toBe(false)
    expect(parseAllowTenantEditSender(null)).toBe(false)
    expect(parseAllowTenantEditSender('true')).toBe(false)
    expect(parseAllowTenantEditSender(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantEditSender(true)).toBe(true)
    expect(parseAllowTenantEditSender(false)).toBe(false)
  })
})
