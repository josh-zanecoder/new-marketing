import { describe, expect, it } from 'vitest'
import { campaignSenderDisplayName } from '../campaignSenderDisplayName'
import { CONTACT_OWNER_SENDER_LABEL } from '../contactOwnerSender'

describe('campaignSenderDisplayName', () => {
  it('uses selected LO name when present', () => {
    expect(
      campaignSenderDisplayName({
        senderMode: 'selected',
        sender: { name: 'Neovern Enricoso', email: 'neovern.e@zanecoder.com' }
      })
    ).toBe('Neovern Enricoso')
  })

  it('prefers merge snapshot first+last over Contact owner / brand sender name', () => {
    expect(
      campaignSenderDisplayName({
        senderMode: 'contact_owner',
        sender: { name: CONTACT_OWNER_SENDER_LABEL, email: 'marketing@example.com' },
        mergeUserSnapshot: {
          firstName: 'Neovern',
          lastName: 'Enricoso',
          email: 'neovern.e@zanecoder.com'
        }
      })
    ).toBe('Neovern Enricoso')
  })

  it('uses session user when snapshot is missing', () => {
    expect(
      campaignSenderDisplayName({
        senderMode: 'contact_owner',
        sender: { name: 'Forge Capital Lending', email: 'marketing@example.com' },
        sessionUser: { firstName: 'Neovern', lastName: 'Enricoso' }
      })
    ).toBe('Neovern Enricoso')
  })

  it('ignores Contact owner placeholder on selected sender', () => {
    expect(
      campaignSenderDisplayName({
        senderMode: 'selected',
        sender: { name: CONTACT_OWNER_SENDER_LABEL, email: 'lo@example.com' },
        sessionUser: { firstName: 'Neovern', lastName: 'Enricoso' }
      })
    ).toBe('Neovern Enricoso')
  })
})
