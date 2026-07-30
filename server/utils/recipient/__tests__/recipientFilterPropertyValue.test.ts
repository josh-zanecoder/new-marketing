import { describe, expect, it } from 'vitest'
import {
  recipientFilterPropertyAcceptsValueList,
  recipientFilterPropertyValueTokens,
  recipientFilterValueIsRegistryKey,
  splitRecipientFilterValueList
} from '~~/shared/utils/recipientFilterPropertyValue'

const COMPANY_WITH_COMMA = 'NEXA Mortgage, LLC _ BP'

describe('recipientFilterPropertyAcceptsValueList', () => {
  it('accepts lists for multi-key contact fields', () => {
    expect(recipientFilterPropertyAcceptsValueList('address', 'state')).toBe(true)
    expect(recipientFilterPropertyAcceptsValueList('address.state', 'none')).toBe(true)
    expect(recipientFilterPropertyAcceptsValueList('source', 'none')).toBe(true)
    expect(recipientFilterPropertyAcceptsValueList('contact_profile', 'profile_type')).toBe(true)
    expect(recipientFilterPropertyAcceptsValueList('relationship_partner', 'partner_email')).toBe(true)
  })

  it('rejects lists for single-value properties', () => {
    expect(recipientFilterPropertyAcceptsValueList('company', 'none')).toBe(false)
    expect(recipientFilterPropertyAcceptsValueList('channel', 'none')).toBe(false)
    expect(recipientFilterPropertyAcceptsValueList('email', 'none')).toBe(false)
    expect(recipientFilterPropertyAcceptsValueList('address', 'city')).toBe(false)
    expect(recipientFilterPropertyAcceptsValueList('address.street', 'none')).toBe(false)
  })
})

describe('recipientFilterPropertyValueTokens', () => {
  it('keeps a company name containing a comma as one value', () => {
    expect(recipientFilterPropertyValueTokens(COMPANY_WITH_COMMA, 'company', 'none')).toEqual([
      COMPANY_WITH_COMMA
    ])
  })

  it('splits state and source lists', () => {
    expect(recipientFilterPropertyValueTokens('AL, AK\nAZ', 'address', 'state')).toEqual([
      'AL',
      'AK',
      'AZ'
    ])
    expect(recipientFilterPropertyValueTokens('webinar; import', 'source', 'none')).toEqual([
      'webinar',
      'import'
    ])
  })

  it('returns nothing for blank or non-string values', () => {
    expect(recipientFilterPropertyValueTokens('   ', 'company', 'none')).toEqual([])
    expect(recipientFilterPropertyValueTokens(null, 'company', 'none')).toEqual([])
    expect(recipientFilterPropertyValueTokens(undefined, 'address', 'state')).toEqual([])
  })
})

describe('splitRecipientFilterValueList', () => {
  it('drops empty segments and surrounding whitespace', () => {
    expect(splitRecipientFilterValueList(' TX ,, AL \n')).toEqual(['TX', 'AL'])
  })
})

describe('recipientFilterValueIsRegistryKey', () => {
  it('treats profile and partner type keys as slugs', () => {
    expect(recipientFilterValueIsRegistryKey('contact_profile', 'profile_subtype')).toBe(true)
    expect(recipientFilterValueIsRegistryKey('profile_type')).toBe(true)
    expect(recipientFilterValueIsRegistryKey('related_partner_type')).toBe(true)
    expect(recipientFilterValueIsRegistryKey('relationship_partner', 'partner_type')).toBe(true)
  })

  it('treats literal contact data as verbatim', () => {
    expect(recipientFilterValueIsRegistryKey('company')).toBe(false)
    expect(recipientFilterValueIsRegistryKey('related_partner_name')).toBe(false)
    expect(recipientFilterValueIsRegistryKey('relationship_partner', 'partner_email')).toBe(false)
  })
})
