import { describe, expect, it } from 'vitest'
import {
  campaignScheduleCloudTaskMatchesCampaign,
  campaignScheduleTaskId,
  newCampaignScheduleCloudTaskId
} from './campaignCloudTasksQueue'

describe('campaign schedule task ids', () => {
  const dbName = 'forge_capital'
  const campaignId = '507f1f77bcf86cd799439011'

  it('keeps a reschedule id discoverable after the original name is reserved', () => {
    const stable = campaignScheduleTaskId(dbName, campaignId)
    const fresh = newCampaignScheduleCloudTaskId(dbName, campaignId, 'm1abc12')
    expect(fresh).not.toBe(stable)
    expect(fresh.startsWith(`${stable}-`)).toBe(true)
    expect(campaignScheduleCloudTaskMatchesCampaign(fresh, campaignId, dbName)).toBe(true)
    expect(campaignScheduleCloudTaskMatchesCampaign(stable, campaignId, dbName)).toBe(true)
    expect(campaignScheduleCloudTaskMatchesCampaign(fresh, 'ffffffffffffffffffffffff', dbName)).toBe(
      false
    )
  })
})
