import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_STATUS_FAILED,
  CAMPAIGN_STATUS_SENT,
  CAMPAIGN_TERMINAL_SEND_STATUSES
} from '../campaignTerminalStatus'

describe('campaignTerminalStatus', () => {
  it('lists Sent and Failed as terminal send statuses', () => {
    expect(CAMPAIGN_TERMINAL_SEND_STATUSES).toEqual([
      CAMPAIGN_STATUS_SENT,
      CAMPAIGN_STATUS_FAILED
    ])
  })
})
