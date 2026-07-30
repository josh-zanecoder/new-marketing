import { describe, expect, it } from 'vitest'
import {
  recipientFilterContactFieldPath,
  recipientFilterSupportsContactValues
} from '~~/shared/utils/recipientFilterContactField'
import { normalizeRecipientFilterValuesFromContacts } from '@server/utils/recipient/recipientFilterValidation'

describe('recipientFilterContactFieldPath', () => {
  it('maps scalar properties to the contact field holding their values', () => {
    expect(recipientFilterContactFieldPath('company', 'none')).toBe('company')
    expect(recipientFilterContactFieldPath('channel', 'none')).toBe('channel')
    expect(recipientFilterContactFieldPath('status', 'none')).toBe('status')
    expect(recipientFilterContactFieldPath('stage', 'none')).toBe('stage')
    expect(recipientFilterContactFieldPath('source', 'none')).toBe('source')
  })

  it('maps address sub types, including legacy dotted properties', () => {
    expect(recipientFilterContactFieldPath('address', 'state')).toBe('address.state')
    expect(recipientFilterContactFieldPath('address', 'city')).toBe('address.city')
    expect(recipientFilterContactFieldPath('address', 'county')).toBe('address.county')
    expect(recipientFilterContactFieldPath('address.county', 'none')).toBe('address.county')
  })

  it('has no field for free-text or multi-key properties', () => {
    expect(recipientFilterContactFieldPath('address', 'street')).toBeNull()
    expect(recipientFilterContactFieldPath('email', 'none')).toBeNull()
    expect(recipientFilterContactFieldPath('contact_profile', 'profile_type')).toBeNull()
    expect(recipientFilterContactFieldPath('relationship_partner', 'partner_email')).toBeNull()
    expect(recipientFilterContactFieldPath('none', 'none')).toBeNull()
  })

  it('reports support in step with the mapping', () => {
    expect(recipientFilterSupportsContactValues('company', 'none')).toBe(true)
    expect(recipientFilterSupportsContactValues('email', 'none')).toBe(false)
  })
})

describe('normalizeRecipientFilterValuesFromContacts', () => {
  it('accepts the option only for supported properties', () => {
    expect(normalizeRecipientFilterValuesFromContacts(true, 'company', 'none')).toBe(true)
    expect(normalizeRecipientFilterValuesFromContacts(true, 'address', 'city')).toBe(true)
    expect(normalizeRecipientFilterValuesFromContacts(true, 'address', 'street')).toBe(false)
    expect(normalizeRecipientFilterValuesFromContacts(true, 'email', 'none')).toBe(false)
    expect(normalizeRecipientFilterValuesFromContacts(true, 'none', 'none')).toBe(false)
  })

  it('treats anything other than true as off', () => {
    expect(normalizeRecipientFilterValuesFromContacts(false, 'company', 'none')).toBe(false)
    expect(normalizeRecipientFilterValuesFromContacts('true', 'company', 'none')).toBe(false)
    expect(normalizeRecipientFilterValuesFromContacts(undefined, 'company', 'none')).toBe(false)
  })
})
