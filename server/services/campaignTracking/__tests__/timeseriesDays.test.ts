import { describe, expect, it } from 'vitest'
import { fillTimeseriesDays } from '../timeseriesDays'

describe('fillTimeseriesDays', () => {
  it('fills missing days with zeros and preserves existing points', () => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const anchor = today.toISOString().slice(0, 10)

    const filled = fillTimeseriesDays(
      [{ date: anchor, delivered: 2, opened: 1, clicked: 0, bounced: 0, other: 0 }],
      3
    )

    expect(filled).toHaveLength(3)
    expect(filled.find((p) => p.date === anchor)).toMatchObject({
      delivered: 2,
      opened: 1
    })
    expect(filled.every((p) => typeof p.date === 'string')).toBe(true)
    expect(filled.filter((p) => p.delivered === 0 && p.opened === 0)).toHaveLength(2)
  })
})
