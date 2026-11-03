import { describe, expect, it } from 'vitest'
import { resolveEditableCampaignSenderMode } from '../resolveEditableCampaignSenderMode'

describe('resolveEditableCampaignSenderMode', () => {
  it('forces contact_owner when edit sender is disabled', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: false,
        senderEmail: 'lo@example.com',
        preferredMode: 'selected'
      })
    ).toBe('contact_owner')
  })

  it('keeps selected when preferred', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: true,
        senderEmail: 'lo@example.com',
        preferredMode: 'selected'
      })
    ).toBe('selected')
  })

  it('treats a directory-matched typed email as selected', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: true,
        senderEmail: 'lo@example.com',
        preferredMode: 'contact_owner',
        directoryMatch: true
      })
    ).toBe('selected')
  })

  it('keeps contact_owner for typed email not in the directory', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: true,
        senderEmail: 'hello+sistarlo@zanecoder.com',
        preferredMode: 'contact_owner',
        directoryMatch: false
      })
    ).toBe('contact_owner')
  })

  it('keeps contact_owner for incomplete search text', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: true,
        senderEmail: 'hello',
        preferredMode: 'contact_owner'
      })
    ).toBe('contact_owner')
  })

  it('keeps preferred contact_owner on save when directoryMatch is omitted', () => {
    expect(
      resolveEditableCampaignSenderMode({
        allowTenantEditSender: true,
        senderEmail: 'hello+sistarlo@zanecoder.com',
        preferredMode: 'contact_owner'
      })
    ).toBe('contact_owner')
  })
})
