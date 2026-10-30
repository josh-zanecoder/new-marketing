import { describe, expect, it } from 'vitest'
import { resolveCampaignSenderDefaultsFromDoc } from '../resolveDefaultCampaignSender'
import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'

describe('resolveCampaignSenderDefaultsFromDoc', () => {
  it('falls back to Forge defaults when edit-sender toggle is off and admin fields are blank', () => {
    expect(
      resolveCampaignSenderDefaultsFromDoc({
        name: 'Acme',
        dbName: 'acme',
        allowTenantEditSender: false
      } as never)
    ).toEqual({
      name: DEFAULT_CAMPAIGN_SENDER_NAME,
      email: DEFAULT_CAMPAIGN_SENDER_EMAIL,
      allowTenantEditSender: false
    })
  })

  it('keeps blank admin name/email when edit-sender toggle is on', () => {
    expect(
      resolveCampaignSenderDefaultsFromDoc({
        name: 'Acme',
        dbName: 'acme',
        allowTenantEditSender: true
      } as never)
    ).toEqual({
      name: '',
      email: '',
      allowTenantEditSender: true
    })
  })

  it('uses configured admin sender when present with toggle on', () => {
    expect(
      resolveCampaignSenderDefaultsFromDoc({
        name: 'Acme',
        dbName: 'acme',
        allowTenantEditSender: true,
        defaultCampaignSenderName: 'Acme Marketing',
        defaultCampaignSenderEmail: 'marketing@acme.test'
      } as never)
    ).toEqual({
      name: 'Acme Marketing',
      email: 'marketing@acme.test',
      allowTenantEditSender: true
    })
  })
})
