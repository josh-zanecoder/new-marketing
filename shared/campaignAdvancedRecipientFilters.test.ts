import { describe, expect, it } from 'vitest'
import {
  advancedFilterListName,
  campaignRecipientsTypeForApi,
  isCampaignLiveListAudience
} from './campaignAdvancedRecipientFilters'

describe('isCampaignLiveListAudience', () => {
  it('is true only for list campaigns with the live flag and a list id', () => {
    expect(
      isCampaignLiveListAudience({
        recipientsType: 'list',
        recipientsListId: '65f0c0ffee0000000000abcd',
        liveListAudience: true
      })
    ).toBe(true)
  })

  it('stays false for classic list snapshots and manual campaigns', () => {
    expect(
      isCampaignLiveListAudience({ recipientsType: 'list', recipientsListId: 'abc', liveListAudience: false })
    ).toBe(false)
    expect(
      isCampaignLiveListAudience({ recipientsType: 'list', recipientsListId: 'abc' })
    ).toBe(false)
    expect(
      isCampaignLiveListAudience({ recipientsType: 'manual', recipientsListId: 'abc', liveListAudience: true })
    ).toBe(false)
  })

  it('requires a non-empty list id', () => {
    expect(
      isCampaignLiveListAudience({ recipientsType: 'list', recipientsListId: '  ', liveListAudience: true })
    ).toBe(false)
    expect(
      isCampaignLiveListAudience({ recipientsType: 'list', recipientsListId: null, liveListAudience: true })
    ).toBe(false)
  })
})

describe('advancedFilterListName', () => {
  it('uses the filter body name when given', () => {
    expect(advancedFilterListName('Spring promo', '  Texas borrowers  ')).toBe('Texas borrowers')
  })

  it('labels the list with the campaign name when no name is given', () => {
    expect(advancedFilterListName(' Spring promo ', '')).toBe('Campaign audience · Spring promo')
    expect(advancedFilterListName('Spring promo', undefined)).toBe('Campaign audience · Spring promo')
  })

  it('caps the list name at 200 characters', () => {
    const long = 'x'.repeat(400)
    expect(advancedFilterListName(long)).toHaveLength(200)
    expect(advancedFilterListName('c', long)).toHaveLength(200)
  })
})

describe('campaignRecipientsTypeForApi', () => {
  it('persists filter-built audiences as list campaigns', () => {
    expect(campaignRecipientsTypeForApi('filters')).toBe('list')
    expect(campaignRecipientsTypeForApi('list')).toBe('list')
    expect(campaignRecipientsTypeForApi('manual')).toBe('manual')
  })
})
