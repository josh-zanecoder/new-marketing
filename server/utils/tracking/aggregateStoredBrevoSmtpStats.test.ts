import { describe, expect, it } from 'vitest'
import { parseYmdToExactUtcBounds } from './brevoTrackingEventDateBounds'

describe('aggregateStoredBrevoSmtpStats date bounds', () => {
  it('builds inclusive local-day UTC bounds for rollups', () => {
    const bounds = parseYmdToExactUtcBounds('2026-08-01', '2026-08-02', 420)
    expect(bounds).not.toBeNull()
    expect(bounds!.start.toISOString()).toBe('2026-08-01T07:00:00.000Z')
    expect(bounds!.end.toISOString()).toBe('2026-08-03T06:59:59.999Z')
  })
})
