import { describe, expect, it } from 'vitest'
import { parseAllowTenantLendingQbStatus } from './allowTenantLendingQbStatus'

describe('parseAllowTenantLendingQbStatus', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantLendingQbStatus(undefined)).toBe(false)
    expect(parseAllowTenantLendingQbStatus(null)).toBe(false)
    expect(parseAllowTenantLendingQbStatus('true')).toBe(false)
    expect(parseAllowTenantLendingQbStatus(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantLendingQbStatus(true)).toBe(true)
    expect(parseAllowTenantLendingQbStatus(false)).toBe(false)
  })
})
