import { describe, expect, it } from 'vitest'
import { resolveTypedCampaignSenderName } from '../resolveTypedCampaignSenderName'

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
})
