import { describe, expect, it } from 'vitest'
import {
  normalizeUserSourceContactPath,
  resolveUserSourceDynamicVariable,
  resolveUserSourceFromSnapshot
} from '../emailTemplateMerge'

describe('normalizeUserSourceContactPath', () => {
  it.each([
    ['user.ownerAvatarUrl', 'metadata.ownerAvatarUrl'],
    ['ownerAvatarUrl', 'metadata.ownerAvatarUrl'],
    ['user.avatar', 'metadata.ownerAvatarUrl'],
    ['avatar', 'metadata.ownerAvatarUrl'],
    ['metadata.ownerAvatarUrl', 'metadata.ownerAvatarUrl'],
    ['user.firstName', 'metadata.ownerFirstName'],
    ['firstName', 'metadata.ownerFirstName']
  ])('maps %s → %s', (input, expected) => {
    expect(normalizeUserSourceContactPath(input)).toBe(expected)
  })
})

describe('resolveUserSourceDynamicVariable', () => {
  const avatar = 'https://cdn.example.com/owners/jane.jpg'
  const contact = {
    metadata: {
      ownerFirstName: 'Clement',
      ownerAvatarUrl: avatar
    }
  }

  it('returns owner phone from contact metadata', () => {
    expect(
      resolveUserSourceDynamicVariable('phone', {
        metadata: { ownerPhone: '9497768200' }
      })
    ).toBe('(949)-776-8200')
  })

  it('returns empty when owner field is missing', () => {
    expect(resolveUserSourceDynamicVariable('phone', { metadata: {} })).toBe('')
  })

  it.each(['user.ownerAvatarUrl', 'ownerAvatarUrl', 'metadata.ownerAvatarUrl'])(
    'resolves avatar via contact path %s',
    (contactPath) => {
      expect(resolveUserSourceDynamicVariable(contactPath, contact)).toBe(avatar)
    }
  )

  it('resolves owner first name via user.* contact path', () => {
    expect(resolveUserSourceDynamicVariable('user.firstName', contact)).toBe('Clement')
  })

  it('resolves owner full name via name contact path', () => {
    expect(
      resolveUserSourceDynamicVariable('name', {
        metadata: { ownerFirstName: 'Lane', ownerLastName: 'Thompson' }
      })
    ).toBe('Lane Thompson')
  })
})

describe('resolveUserSourceFromSnapshot', () => {
  const snapshot = {
    firstName: 'Lane',
    lastName: 'Thompson',
    email: 'lane.thompson@example.com',
    phone: '9495550100'
  }

  it('resolves AE email aliases from the operator snapshot', () => {
    expect(resolveUserSourceFromSnapshot('aeEmail', snapshot)).toBe('lane.thompson@example.com')
    expect(resolveUserSourceFromSnapshot('user.email', snapshot)).toBe('lane.thompson@example.com')
  })

  it('resolves AE name and phone from the operator snapshot', () => {
    expect(resolveUserSourceFromSnapshot('aeFullName', snapshot)).toBe('Lane Thompson')
    expect(resolveUserSourceFromSnapshot('aePhoneNumber', snapshot)).toBe('(949)-555-0100')
  })

  it('returns empty when snapshot is missing the field', () => {
    expect(resolveUserSourceFromSnapshot('aeEmail', { firstName: 'Lane' })).toBe('')
  })
})
