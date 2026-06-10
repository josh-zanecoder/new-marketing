import { describe, expect, it } from 'vitest'
import { campaignBatchCloudTaskMatchesCampaign } from '../campaignCloudTasksQueue'

describe('campaignBatchCloudTaskMatchesCampaign', () => {
  const dbName = '15k_db'
  const campaignId = '6a284dbf3dd27132fefebaa2'
  const sendRunId = 'd5b61666-598c-48c1-a95b-1010ad541d28'

  it('matches task id for campaign and db', () => {
    const taskId = `cs-batch-${dbName}-${campaignId}-${sendRunId}-p0`
    expect(campaignBatchCloudTaskMatchesCampaign(taskId, campaignId, dbName)).toBe(true)
  })

  it('filters by sendRunId when provided', () => {
    const taskId = `cs-batch-${dbName}-${campaignId}-${sendRunId}-p0`
    expect(
      campaignBatchCloudTaskMatchesCampaign(taskId, campaignId, dbName, 'other-run-id')
    ).toBe(false)
  })

  it('rejects unrelated tasks', () => {
    expect(campaignBatchCloudTaskMatchesCampaign('cs-other', campaignId, dbName)).toBe(false)
  })
})
