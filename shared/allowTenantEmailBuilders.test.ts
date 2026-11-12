import { describe, expect, it } from 'vitest'
import { parseAllowTenantEditText } from './allowTenantEditText'
import { parseAllowTenantBeefreeBuilder } from './allowTenantBeefreeBuilder'
import { parseAllowTenantGrapesBuilder } from './allowTenantGrapesBuilder'
import { parseAllowTenantResizeImage } from './allowTenantResizeImage'
import { parseAllowTenantTemplateBuilder } from './allowTenantTemplateBuilder'

describe('email builder tenant flags', () => {
  it('defaults missing values to false', () => {
    expect(parseAllowTenantGrapesBuilder(undefined)).toBe(false)
    expect(parseAllowTenantGrapesBuilder('true')).toBe(false)
    expect(parseAllowTenantBeefreeBuilder(undefined)).toBe(false)
    expect(parseAllowTenantBeefreeBuilder('true')).toBe(false)
    expect(parseAllowTenantTemplateBuilder(null)).toBe(false)
    expect(parseAllowTenantTemplateBuilder(1)).toBe(false)
    expect(parseAllowTenantEditText(undefined)).toBe(false)
    expect(parseAllowTenantEditText('true')).toBe(false)
    expect(parseAllowTenantResizeImage(null)).toBe(false)
    expect(parseAllowTenantResizeImage(1)).toBe(false)
  })

  it('accepts only boolean true', () => {
    expect(parseAllowTenantGrapesBuilder(true)).toBe(true)
    expect(parseAllowTenantGrapesBuilder(false)).toBe(false)
    expect(parseAllowTenantBeefreeBuilder(true)).toBe(true)
    expect(parseAllowTenantBeefreeBuilder(false)).toBe(false)
    expect(parseAllowTenantTemplateBuilder(true)).toBe(true)
    expect(parseAllowTenantTemplateBuilder(false)).toBe(false)
    expect(parseAllowTenantEditText(true)).toBe(true)
    expect(parseAllowTenantEditText(false)).toBe(false)
    expect(parseAllowTenantResizeImage(true)).toBe(true)
    expect(parseAllowTenantResizeImage(false)).toBe(false)
  })
})
