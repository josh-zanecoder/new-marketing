import { describe, expect, it } from 'vitest'
import {
  isEmailShapedSenderDisplayName,
  resolveTypedCampaignSenderName
} from '../resolveTypedCampaignSenderName'

describe('isEmailShapedSenderDisplayName', () => {
  it('treats empty or email-equal names as needing a directory lookup', () => {
    expect(isEmailShapedSenderDisplayName('', 'hello@example.com')).toBe(true)
    expect(isEmailShapedSenderDisplayName('hello@example.com', 'hello@example.com')).toBe(true)
    expect(isEmailShapedSenderDisplayName('Hello@Example.com', 'hello@example.com')).toBe(true)
    expect(isEmailShapedSenderDisplayName('Jane Smith', 'hello@example.com')).toBe(false)
  })
})

describe('resolveTypedCampaignSenderName', () => {
  it('uses tenant display name when email is not an existing LO or session user', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'neovern.e@zanecoder.com',
        defaultDisplayName: 'Forge Capital Lending',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker'
      })
    ).toBe('Forge Capital Lending')
  })

  it('keeps session LO name when typed email matches the logged-in user', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'john.broker@example.com',
        defaultDisplayName: 'Forge Capital Lending',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker'
      })
    ).toBe('John Broker')
  })

  it('prefers matched LO candidate display name over session and default', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'jane@example.com',
        defaultDisplayName: 'Forge Capital Lending',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker',
        matchedCandidateDisplayName: 'Jane Loan Officer'
      })
    ).toBe('Jane Loan Officer')
  })

  it('keeps classic matched-name behavior even when the match equals the email', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'hello+sistarlo@zanecoder.com',
        defaultDisplayName: 'Forge Capital Lending',
        sessionEmail: 'admin@example.com',
        sessionDisplayName: 'Admin',
        matchedCandidateDisplayName: 'hello+sistarlo@zanecoder.com'
      })
    ).toBe('hello+sistarlo@zanecoder.com')
  })
})
