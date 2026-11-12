import { describe, expect, it } from 'vitest'
import { parseAllowTenantGrapesBuilder } from './allowTenantGrapesBuilder'
import { parseAllowTenantTemplateBuilder } from './allowTenantTemplateBuilder'

describe('email builder tenant flags', () => {
  it('defaults missing values to false', () => {
    expect(parseAllowTenantGrapesBuilder(undefined)).toBe(false)
    expect(parseAllowTenantGrapesBuilder('true')).toBe(false)
    expect(parseAllowTenantTemplateBuilder(null)).toBe(false)
    expect(parseAllowTenantTemplateBuilder(1)).toBe(false)
  })

  it('accepts only boolean true', () => {
    expect(parseAllowTenantGrapesBuilder(true)).toBe(true)
    expect(parseAllowTenantGrapesBuilder(false)).toBe(false)
    expect(parseAllowTenantTemplateBuilder(true)).toBe(true)
    expect(parseAllowTenantTemplateBuilder(false)).toBe(false)
  })
})
