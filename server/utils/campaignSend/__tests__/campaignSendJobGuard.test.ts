import { describe, expect, it } from 'vitest'
import { campaignSendJobShouldSkip, campaignSendJobShouldBlockEnqueue } from '../campaignSendJobGuard'

describe('campaignSendJobGuard', () => {
  it('skips jobs when campaign is Cancelled', () => {
    expect(
      campaignSendJobShouldSkip(
        { status: 'Cancelled', sendRunId: 'run-1' },
        'run-1'
      )
    ).toBe(true)
  })

  it('skips jobs when campaign is Paused', () => {
    expect(
      campaignSendJobShouldSkip({ status: 'Paused', sendRunId: 'run-1' }, 'run-1')
    ).toBe(true)
  })

  it('runs jobs when campaign is Sending with matching sendRunId', () => {
    expect(
      campaignSendJobShouldSkip({ status: 'Sending', sendRunId: 'run-1' }, 'run-1')
    ).toBe(false)
  })

  it('blocks enqueue when sendRunId is stale', () => {
    expect(
      campaignSendJobShouldBlockEnqueue({ status: 'Sending', sendRunId: 'run-2' }, 'run-1')
    ).toBe(true)
  })

  it('blocks enqueue when campaign is Paused', () => {
    expect(
      campaignSendJobShouldBlockEnqueue({ status: 'Paused', sendRunId: 'run-1' }, 'run-1')
    ).toBe(true)
  })
})
