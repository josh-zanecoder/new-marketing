import { describe, expect, it } from 'vitest'
import { buildContactFilterQuery } from '@server/utils/recipient/recipientListMembershipQuery'
import { registryDocToCriteria } from '@server/utils/recipient/recipientListNormalization'

const COMPANY = 'NEXA Mortgage, LLC _ BP'

/** Mirrors the tenant list save: a registry filter with no saved value plus a typed row value. */
function tenantRowCriteria(listPropertyValue: string) {
  const filterDoc = { property: 'company', propertyType: 'none', propertyValue: '' }
  const effectiveValue = listPropertyValue || filterDoc.propertyValue
  return registryDocToCriteria({ ...filterDoc, propertyValue: effectiveValue })
}

function companyRegex(value: string): RegExp | undefined {
  const criteria = tenantRowCriteria(value)
  const query = buildContactFilterQuery('client', criteria, 'and', [criteria]) as {
    company?: { $regex?: RegExp }
  }
  return query.company?.$regex
}

describe('tenant recipient list company filter', () => {
  it('keeps the typed value whole, commas and underscores included', () => {
    expect(tenantRowCriteria(COMPANY)).toEqual([{ property: 'company', value: COMPANY }])
  })

  it('matches contacts whose company is exactly what was typed', () => {
    const regex = companyRegex(COMPANY)
    expect(regex).toBeInstanceOf(RegExp)
    expect(regex?.source).toBe('^NEXA Mortgage, LLC _ BP$')
    expect(regex?.test(COMPANY)).toBe(true)
    expect(regex?.test('nexa mortgage, llc _ bp')).toBe(true)
    expect(regex?.test('NEXA Mortgage')).toBe(false)
  })
})
