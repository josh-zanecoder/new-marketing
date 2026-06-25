import { describe, expect, it } from 'vitest'
import {
  buildSenderFromContactOwner,
  buildReplyToFromContactOwner
} from '../replyToFromContactMetadata'

const operator = {
  firstName: 'Alex',
  lastName: 'Operator',
  email: 'alex@example.com'
}

const variableFallback = {
  firstName: 'Forge Capital',
  lastName: 'Lending',
  email: 'info@myfcltpo.com'
}

describe('buildSenderFromContactOwner', () => {
  it('uses contact owner name when present', () => {
    expect(
      buildSenderFromContactOwner(
        {
          metadata: {
            ownerFirstName: 'Jane',
            ownerLastName: 'Smith',
            ownerEmail: 'jane@example.com'
          }
        },
        { name: 'Forge Capital Lending', email: 'marketing@example.com' },
        operator
      )
    ).toEqual({
      name: 'Jane Smith',
      email: 'marketing@example.com'
    })
  })

  it('falls back to dynamic variable name when contact has no owner', () => {
    expect(
      buildSenderFromContactOwner(null, {
        name: 'Forge Capital Lending',
        email: 'marketing@example.com'
      }, operator, variableFallback)
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'marketing@example.com'
    })
  })

  it('falls back to operator name when owner and dynamic fallbacks are missing', () => {
    expect(
      buildSenderFromContactOwner(null, {
        name: 'Forge Capital Lending',
        email: 'marketing@example.com'
      }, operator)
    ).toEqual({
      name: 'Alex Operator',
      email: 'marketing@example.com'
    })
  })

  it('falls back to campaign sender name when owner and operator are missing', () => {
    expect(
      buildSenderFromContactOwner(null, {
        name: 'Forge Capital Lending',
        email: 'marketing@example.com'
      })
    ).toEqual({
      name: 'Forge Capital Lending',
      email: 'marketing@example.com'
    })
  })
})

describe('buildReplyToFromContactOwner', () => {
  it('uses owner email and name when present', () => {
    expect(
      buildReplyToFromContactOwner({
        metadata: {
          ownerFirstName: 'Jane',
          ownerLastName: 'Smith',
          ownerEmail: 'jane@example.com'
        }
      }, operator)
    ).toEqual({
      email: 'jane@example.com',
      name: 'Jane Smith'
    })
  })

  it('falls back to dynamic variable email before operator', () => {
    expect(buildReplyToFromContactOwner(null, operator, variableFallback)).toEqual({
      email: 'info@myfcltpo.com',
      name: 'Forge Capital Lending'
    })
  })

  it('falls back to operator when contact has no owner email and no dynamic fallback', () => {
    expect(buildReplyToFromContactOwner(null, operator)).toEqual({
      email: 'alex@example.com',
      name: 'Alex Operator'
    })
  })

  it('uses owner email as name when owner has email but no display name', () => {
    expect(
      buildReplyToFromContactOwner(
        { metadata: { ownerEmail: 'jane@example.com' } },
        operator
      )
    ).toEqual({
      email: 'jane@example.com',
      name: 'jane@example.com'
    })
  })

  it('returns undefined when owner, dynamic fallback, and operator have no email', () => {
    expect(buildReplyToFromContactOwner(null)).toBeUndefined()
    expect(buildReplyToFromContactOwner({ metadata: { ownerFirstName: 'Jane' } })).toBeUndefined()
  })
})
