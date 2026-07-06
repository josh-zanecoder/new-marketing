import { describe, expect, it } from 'vitest'
import {
  normalizeUserSourceContactPath,
  resolveUserSourceDynamicVariable
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
    ).toBe('(949) 776-8200')
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
})
