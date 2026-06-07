import { describe, expect, it } from 'vitest'
import { campaignSendJobShouldSkip } from '../campaignSendJobGuard'

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
})
