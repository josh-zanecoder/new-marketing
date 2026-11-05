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
  it('uses tenant optional Sender name when email is not an existing LO or session user', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'neovern.e@zanecoder.com',
        defaultDisplayName: 'sistar stage',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker'
      })
    ).toBe('sistar stage')
  })

  it('keeps session LO name when typed email matches the logged-in user', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'john.broker@example.com',
        defaultDisplayName: 'sistar stage',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker'
      })
    ).toBe('John Broker')
  })

  it('prefers matched LO candidate display name over session and tenant default', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'jane@example.com',
        defaultDisplayName: 'sistar stage',
        sessionEmail: 'john.broker@example.com',
        sessionDisplayName: 'John Broker',
        matchedCandidateDisplayName: 'Jane Loan Officer'
      })
    ).toBe('Jane Loan Officer')
  })

  it('keeps matched-name even when the match equals the email', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'hello+sistarlo@zanecoder.com',
        defaultDisplayName: 'sistar stage',
        sessionEmail: 'admin@example.com',
        sessionDisplayName: 'Admin',
        matchedCandidateDisplayName: 'hello+sistarlo@zanecoder.com'
      })
    ).toBe('hello+sistarlo@zanecoder.com')
  })

  it('uses tenant Sender name for an unknown typed email (not the logged-in user)', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'wilson@zanecoder.com',
        defaultDisplayName: 'sistar stage',
        sessionEmail: 'michael.jordan@zanecoder.com',
        sessionDisplayName: 'Michael Jordan',
        matchedCandidateDisplayName: null
      })
    ).toBe('sistar stage')
  })

  it('leaves name empty when tenant optional Sender name is empty', () => {
    expect(
      resolveTypedCampaignSenderName({
        senderEmail: 'not-in-directory@example.com',
        defaultDisplayName: '',
        sessionEmail: 'om@zanecoder.com',
        sessionDisplayName: 'OM Manager',
        matchedCandidateDisplayName: ''
      })
    ).toBe('')
  })
})
