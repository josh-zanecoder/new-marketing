import { describe, expect, it } from 'vitest'
import { outstandingSendWorkFromStatusCounts } from '../countRecipientStatuses'

describe('outstandingSendWorkFromStatusCounts', () => {
  it('sums pending, sending, and retryable failed', () => {
    expect(
      outstandingSendWorkFromStatusCounts({
        pending: 100,
        sending: 400,
        failed: 2
      })
    ).toBe(502)
  })
})
