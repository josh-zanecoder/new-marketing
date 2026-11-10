import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveCampaignEditScheduleAction } from './campaignEditScheduleAction'

describe('resolveCampaignEditScheduleAction', () => {
  it('uses Schedule send for drafts and unscheduled campaigns', () => {
    expect(resolveCampaignEditScheduleAction('Draft', undefined)).toBe('schedule')
    expect(resolveCampaignEditScheduleAction('Draft', '')).toBe('schedule')
    expect(resolveCampaignEditScheduleAction('Scheduled', '')).toBe('schedule')
    expect(resolveCampaignEditScheduleAction('Sending', '2026-11-10T12:00:00.000Z')).toBe(
      'schedule'
    )
  })

  it('uses Reschedule when editing a Scheduled campaign with a send time', () => {
    expect(
      resolveCampaignEditScheduleAction('Scheduled', '2026-11-10T12:00:00.000Z')
    ).toBe('reschedule')
  })
})

describe('edit wizard schedule / reschedule wiring', () => {
  it('binds footer and modal copy to the resolved action', () => {
    const source = readFileSync('app/pages/tenant/campaigns/edit/[id].vue', 'utf8')
    expect(source).toContain('resolveCampaignEditScheduleAction')
    expect(source).toContain('CAMPAIGN_SCHEDULE_ACTION_RESCHEDULE')
    expect(source).toContain('CAMPAIGN_SCHEDULE_ACTION_SCHEDULE')
    expect(source).toContain('canRescheduleScheduled')
    expect(source).toContain('isEditRescheduleMode')
  })
})
