import { describe, expect, it } from 'vitest'
import { EXCLUDE_CAMPAIGN_AUDIENCE_LISTS } from '../campaignAudienceListFilter'
import { advancedFilterListName } from '~~/shared/campaignAdvancedRecipientFilters'

describe('EXCLUDE_CAMPAIGN_AUDIENCE_LISTS', () => {
  it('skips flagged lists', () => {
    expect(EXCLUDE_CAMPAIGN_AUDIENCE_LISTS.campaignAudience).toEqual({ $ne: true })
  })

  it('also skips auto-named lists made before the flag existed', () => {
    const { $not } = EXCLUDE_CAMPAIGN_AUDIENCE_LISTS.name as { $not: RegExp }
    expect($not.test(advancedFilterListName('Spring promo'))).toBe(true)
    expect($not.test('My Texas borrowers')).toBe(false)
  })
})
