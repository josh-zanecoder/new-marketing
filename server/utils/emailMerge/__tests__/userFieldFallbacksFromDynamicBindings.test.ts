import { describe, expect, it } from 'vitest'
import { userMergeSnapshotFromDynamicVariableFallbacks } from '../userFieldFallbacksFromDynamicBindings'

describe('userMergeSnapshotFromDynamicVariableFallbacks', () => {
  it('reads fallback values for user.firstName, user.lastName, and user.email', () => {
    expect(
      userMergeSnapshotFromDynamicVariableFallbacks([
        {
          key: 'user.firstName',
          contactPath: 'firstName',
          sourceType: 'user',
          enabled: true,
          fallbackValue: 'Forge Capital'
        },
        {
          key: 'user.lastName',
          contactPath: 'lastName',
          sourceType: 'user',
          enabled: true,
          fallbackValue: 'Lending'
        },
        {
          key: 'user.email',
          contactPath: 'email',
          sourceType: 'user',
          enabled: true,
          fallbackValue: 'Info@myfcltpo.com'
        }
      ])
    ).toEqual({
      firstName: 'Forge Capital',
      lastName: 'Lending',
      email: 'info@myfcltpo.com'
    })
  })

  it('ignores recipient bindings and empty fallbacks', () => {
    expect(
      userMergeSnapshotFromDynamicVariableFallbacks([
        {
          key: 'recipient.email',
          contactPath: 'email',
          sourceType: 'recipient',
          enabled: true,
          fallbackValue: 'noreply@example.com'
        },
        {
          key: 'user.email',
          contactPath: 'email',
          sourceType: 'user',
          enabled: true,
          fallbackValue: ''
        }
      ])
    ).toBeUndefined()
  })
})
