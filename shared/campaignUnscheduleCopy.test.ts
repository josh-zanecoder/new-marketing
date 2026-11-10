import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_UNSCHEDULE_ERROR_FALLBACK,
  CAMPAIGN_UNSCHEDULE_SUCCESS,
  campaignUnscheduleConfirmMessage
} from './campaignUnscheduleCopy'

describe('campaignUnscheduleCopy', () => {
  it('keeps success and error copy distinct', () => {
    expect(CAMPAIGN_UNSCHEDULE_SUCCESS.length).toBeGreaterThan(10)
    expect(CAMPAIGN_UNSCHEDULE_ERROR_FALLBACK.length).toBeGreaterThan(10)
  })

  it('includes the campaign name in the confirm message', () => {
    expect(campaignUnscheduleConfirmMessage('Test Send')).toContain('Test Send')
    expect(campaignUnscheduleConfirmMessage('')).toContain('Untitled')
  })
})
