import { describe, expect, it } from 'vitest'
import {
  mergeDynamicVariableValue,
  mergeMustacheTemplate,
  resolveUserSourceDynamicVariable
} from '../../../../shared/utils/emailTemplateMerge'
import { composeEmailMergeRoot } from '../composeMergeRoot'

describe('resolveUserSourceDynamicVariable', () => {
  it('returns AE phone from contact metadata', () => {
    expect(
      resolveUserSourceDynamicVariable('phone', {
        metadata: { ownerPhone: '9497768200' }
      })
    ).toBe('(949) 776-8200')
  })

  it('does not fall back to session user when AE is missing', () => {
    expect(resolveUserSourceDynamicVariable('phone', { metadata: {} })).toBe('')
  })
})

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
  it('applies per-variable fallback when AE is missing', () => {
    const root = composeEmailMergeRoot(
      {
        metadata: {}
      },
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

  it('prefers AE over fallback', () => {
    const root = composeEmailMergeRoot(
      {
        metadata: {
          ownerPhone: '5551234567',
          ownerEmail: 'ae@example.com'
        }
      },
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

  it('leaves token empty when AE and fallback are both missing', () => {
    const root = composeEmailMergeRoot(
      { metadata: {} },
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
})
