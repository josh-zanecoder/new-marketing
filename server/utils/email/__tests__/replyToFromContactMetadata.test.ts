import { describe, expect, it } from 'vitest'
import {
  applyCampaignFromAddressMode,
  buildSenderFromContactOwner,
  buildReplyToFromContactOwner,
  resolveSelectedLoSender
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

  it('ignores legacy Contact owner placeholder and uses operator name', () => {
    expect(
      buildSenderFromContactOwner(
        null,
        { name: 'Contact owner', email: 'marketing@example.com' },
        operator
      )
    ).toEqual({
      name: 'Alex Operator',
      email: 'marketing@example.com'
    })
  })
})

describe('resolveSelectedLoSender', () => {
  it('keeps an explicit LO display name', () => {
    expect(
      resolveSelectedLoSender(
        { name: 'Neovern Enricoso', email: 'neovern.e@zanecoder.com' },
        operator
      )
    ).toEqual({
      name: 'Neovern Enricoso',
      email: 'neovern.e@zanecoder.com'
    })
  })

  it('replaces Contact owner placeholder with matching operator first+last', () => {
    expect(
      resolveSelectedLoSender(
        { name: 'Contact owner', email: 'alex@example.com' },
        operator
      )
    ).toEqual({
      name: 'Alex Operator',
      email: 'alex@example.com'
    })
  })

  it('falls back to email when placeholder and operator email differ', () => {
    expect(
      resolveSelectedLoSender(
        { name: 'Contact owner', email: 'lo@example.com' },
        operator
      )
    ).toEqual({
      name: 'lo@example.com',
      email: 'lo@example.com'
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

describe('applyCampaignFromAddressMode', () => {
  const sender = { name: 'Forge Capital Lending', email: 'marketing@example.com' }
  const replyTo = { name: 'Jane Smith', email: 'jane@example.com' }

  it('keeps the default sender when mode is default', () => {
    expect(applyCampaignFromAddressMode(sender, replyTo, 'default')).toEqual(sender)
  })

  it('copies Reply-To onto From when mode is contact_owner', () => {
    expect(applyCampaignFromAddressMode(sender, replyTo, 'contact_owner')).toEqual({
      name: 'Jane Smith',
      email: 'jane@example.com'
    })
  })

  it('keeps the default sender when contact_owner has no Reply-To', () => {
    expect(applyCampaignFromAddressMode(sender, undefined, 'contact_owner')).toEqual(sender)
  })

  it('does not copy Contact owner placeholder onto From when Reply-To has no name', () => {
    expect(
      applyCampaignFromAddressMode(
        { name: 'Contact owner', email: 'marketing@example.com' },
        { name: '', email: 'jane@example.com' },
        'contact_owner'
      )
    ).toEqual({
      name: 'jane@example.com',
      email: 'jane@example.com'
    })
  })
})
