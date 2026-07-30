import { describe, expect, it } from 'vitest'
import { registryDocToCriteria } from '@server/utils/recipient/recipientListNormalization'

describe('registryDocToCriteria', () => {
  it('matches a company name containing a comma in full', () => {
    expect(
      registryDocToCriteria({
        property: 'company',
        propertyType: 'none',
        propertyValue: 'NEXA Mortgage, LLC _ BP'
      })
    ).toEqual([{ property: 'company', value: 'NEXA Mortgage, LLC _ BP' }])
  })

  it('keeps commas in city, street and email values', () => {
    expect(
      registryDocToCriteria({
        property: 'address',
        propertyType: 'city',
        propertyValue: 'Kansas City, MO'
      })
    ).toEqual([{ property: 'city', value: 'Kansas City, MO' }])
    expect(
      registryDocToCriteria({
        property: 'address',
        propertyType: 'street',
        propertyValue: '123 Main St, Suite 200'
      })
    ).toEqual([{ property: 'street', value: '123 Main St, Suite 200' }])
  })

  it('still expands state lists into one criterion per state', () => {
    expect(
      registryDocToCriteria({
        property: 'address',
        propertyType: 'state',
        propertyValue: 'AL, AK, AZ'
      })
    ).toEqual([
      { property: 'state', value: 'AL' },
      { property: 'state', value: 'AK' },
      { property: 'state', value: 'AZ' }
    ])
  })

  it('still expands profile subtype lists', () => {
    expect(
      registryDocToCriteria({
        property: 'contact_profile',
        propertyType: 'profile_subtype',
        propertyValue: 'real_estate, title'
      })
    ).toEqual([
      { property: 'profile_subtype', value: 'real_estate' },
      { property: 'profile_subtype', value: 'title' }
    ])
  })

  it('returns nothing without a property or value', () => {
    expect(registryDocToCriteria({ property: 'none', propertyValue: 'NEXA' })).toEqual([])
    expect(registryDocToCriteria({ property: 'company', propertyValue: '  ' })).toEqual([])
  })
})
