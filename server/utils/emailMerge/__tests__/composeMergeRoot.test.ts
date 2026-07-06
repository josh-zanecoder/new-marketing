import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import type { ContactLean } from '@server/types/tenant/contact.model'
import { mergeDynamicVariableValue, mergeMustacheTemplate } from '../../../../shared/utils/emailTemplateMerge'
import { composeEmailMergeRoot } from '../composeMergeRoot'

function testContact(overrides: Partial<ContactLean> = {}): ContactLean {
  return {
    _id: new Types.ObjectId(),
    firstName: '',
    lastName: '',
    email: '',
    channel: 'email',
    ...overrides
  }
}

describe('mergeDynamicVariableValue', () => {
  it('uses primary when present', () => {
    expect(mergeDynamicVariableValue('AE Phone', '(949) 776-8200')).toBe('AE Phone')
  })

  it('uses fallback when primary is empty', () => {
    expect(mergeDynamicVariableValue('', '(949) 776-8200')).toBe('(949) 776-8200')
  })

  it('returns empty when both are missing', () => {
    expect(mergeDynamicVariableValue('', '')).toBe('')
  })
})

describe('composeEmailMergeRoot', () => {
  it('applies per-variable fallback when owner fields are missing', () => {
    const root = composeEmailMergeRoot(
      testContact({ metadata: {} }),
      [
        {
          key: 'user.phone',
          contactPath: 'phone',
          sourceType: 'user',
          enabled: true,
          fallbackValue: '(949) 776-8200'
        },
        {
          key: 'user.email',
          contactPath: 'email',
          sourceType: 'user',
          enabled: true,
          fallbackValue: 'Info@myfcltpo.com'
        }
      ]
    )

    const html = mergeMustacheTemplate(
      'FCL Number: {{user.phone}} | FCL Email: {{user.email}}',
      root
    )
    expect(html).toBe('FCL Number: (949) 776-8200 | FCL Email: info@myfcltpo.com')
  })

  it('prefers owner metadata over fallback', () => {
    const root = composeEmailMergeRoot(
      testContact({
        metadata: {
          ownerPhone: '5551234567',
          ownerEmail: 'ae@example.com'
        }
      }),
      [
        {
          key: 'user.phone',
          contactPath: 'phone',
          sourceType: 'user',
          enabled: true,
          fallbackValue: '(949) 776-8200'
        }
      ]
    )

    expect(mergeMustacheTemplate('{{user.phone}}', root)).toBe('(555) 123-4567')
  })

  it('leaves token empty when owner data and fallback are both missing', () => {
    const root = composeEmailMergeRoot(
      testContact({ metadata: {} }),
      [
        {
          key: 'user.phone',
          contactPath: 'phone',
          sourceType: 'user',
          enabled: true,
          fallbackValue: ''
        }
      ]
    )

    expect(mergeMustacheTemplate('Phone: {{user.phone}}', root)).toBe('Phone: ')
  })

  it.each(['user.ownerAvatarUrl', 'ownerAvatarUrl', 'metadata.ownerAvatarUrl'])(
    'resolves user.avatar via contact path %s',
    (contactPath) => {
      const avatar = 'https://cdn.example.com/owners/jane.jpg'
      const root = composeEmailMergeRoot(
        testContact({ metadata: { ownerAvatarUrl: avatar } }),
        [
          {
            key: 'user.avatar',
            contactPath,
            sourceType: 'user',
            enabled: true,
            fallbackValue: ''
          }
        ]
      )

      expect(mergeMustacheTemplate('<img src="{{user.avatar}}">', root)).toBe(
        `<img src="${avatar}">`
      )
    }
  )
})
