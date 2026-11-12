import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_SCHEDULE_ACTION_RESCHEDULE,
  CAMPAIGN_SCHEDULE_ACTION_SCHEDULE,
  CAMPAIGN_SCHEDULE_CONFIRM_RESCHEDULE,
  CAMPAIGN_SCHEDULE_CONFIRM_SCHEDULE,
  CAMPAIGN_SCHEDULE_FAIL_SCHEDULE,
  CAMPAIGN_SCHEDULE_MODAL_TITLE_RESCHEDULE,
  CAMPAIGN_SCHEDULE_MODAL_TITLE_SCHEDULE,
  CAMPAIGN_SCHEDULE_SUCCESS
} from './campaignScheduleWizardCopy'

describe('campaignScheduleWizardCopy', () => {
  it('keeps Schedule send and Reschedule labels distinct', () => {
    expect(CAMPAIGN_SCHEDULE_ACTION_SCHEDULE).toBe('Schedule send')
    expect(CAMPAIGN_SCHEDULE_ACTION_RESCHEDULE).toBe('Reschedule')
    expect(CAMPAIGN_SCHEDULE_MODAL_TITLE_SCHEDULE).toBe('Schedule send')
    expect(CAMPAIGN_SCHEDULE_MODAL_TITLE_RESCHEDULE).toBe('Reschedule send')
    expect(CAMPAIGN_SCHEDULE_CONFIRM_SCHEDULE).toBe('Schedule')
    expect(CAMPAIGN_SCHEDULE_CONFIRM_RESCHEDULE).toBe('Save schedule')
  })

  it('uses the product success notification copy', () => {
    expect(CAMPAIGN_SCHEDULE_SUCCESS).toBe('Campaign scheduled successfully.')
    expect(CAMPAIGN_SCHEDULE_SUCCESS).not.toBe(CAMPAIGN_SCHEDULE_FAIL_SCHEDULE)
  })
})
