import { describe, expect, it } from 'vitest'
import {
  campaignScheduleCloudTaskMatchesCampaign,
  legacyCampaignScheduleCloudTaskId,
  newCampaignScheduleCloudTaskId
} from '../campaignScheduleCloudTaskId'

describe('campaignScheduleCloudTaskId', () => {
  const dbName = 'acme_db'
  const campaignId = '6af1ee36d0aa8ed09bdc2b16'

  it('builds the legacy deterministic id used before the tombstone fix', () => {
    expect(legacyCampaignScheduleCloudTaskId(dbName, campaignId)).toBe(
      `cs-schedule-${dbName}-${campaignId}`
    )
  })

  it('mints unique ids so cancel → schedule-again avoids Cloud Tasks tombstones', () => {
    const a = newCampaignScheduleCloudTaskId(dbName, campaignId, 'aaa111')
    const b = newCampaignScheduleCloudTaskId(dbName, campaignId, 'bbb222')
    expect(a).toBe(`cs-schedule-${dbName}-${campaignId}-aaa111`)
    expect(b).toBe(`cs-schedule-${dbName}-${campaignId}-bbb222`)
    expect(a).not.toBe(b)
    expect(a).not.toBe(legacyCampaignScheduleCloudTaskId(dbName, campaignId))
  })

  it('auto-suffixes when no unique token is provided', () => {
    const a = newCampaignScheduleCloudTaskId(dbName, campaignId)
    const b = newCampaignScheduleCloudTaskId(dbName, campaignId)
    expect(a.startsWith(`cs-schedule-${dbName}-${campaignId}-`)).toBe(true)
    expect(b.startsWith(`cs-schedule-${dbName}-${campaignId}-`)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('matches both legacy and unique-suffix schedule task ids for cancel cleanup', () => {
    const legacy = legacyCampaignScheduleCloudTaskId(dbName, campaignId)
    const unique = newCampaignScheduleCloudTaskId(dbName, campaignId, 'deadbeef')
    expect(campaignScheduleCloudTaskMatchesCampaign(legacy, campaignId, dbName)).toBe(true)
    expect(campaignScheduleCloudTaskMatchesCampaign(unique, campaignId, dbName)).toBe(true)
    expect(
      campaignScheduleCloudTaskMatchesCampaign(
        `cs-schedule-other_db-${campaignId}-x`,
        campaignId,
        dbName
      )
    ).toBe(false)
    expect(campaignScheduleCloudTaskMatchesCampaign('cs-batch-x', campaignId, dbName)).toBe(false)
  })
})
