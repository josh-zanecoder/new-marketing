import { describe, expect, it } from 'vitest'
import { parseAllowTenantTemplateApproval } from './allowTenantTemplateApproval'

describe('parseAllowTenantTemplateApproval', () => {
  it('defaults missing/unknown to false', () => {
    expect(parseAllowTenantTemplateApproval(undefined)).toBe(false)
    expect(parseAllowTenantTemplateApproval(null)).toBe(false)
    expect(parseAllowTenantTemplateApproval('true')).toBe(false)
    expect(parseAllowTenantTemplateApproval(1)).toBe(false)
  })

  it('only accepts boolean true', () => {
    expect(parseAllowTenantTemplateApproval(true)).toBe(true)
    expect(parseAllowTenantTemplateApproval(false)).toBe(false)
  })
})
