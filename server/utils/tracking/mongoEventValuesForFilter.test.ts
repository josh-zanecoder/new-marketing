import { describe, expect, it } from 'vitest'
import { mongoEventValuesForFilter } from './mongoEventValuesForFilter'

describe('mongoEventValuesForFilter', () => {
  it('returns null when no event type is selected', () => {
    expect(mongoEventValuesForFilter(null)).toBeNull()
    expect(mongoEventValuesForFilter('')).toBeNull()
    expect(mongoEventValuesForFilter('  ')).toBeNull()
  })

  it('maps bounced to hard and soft bounce variants', () => {
    expect(mongoEventValuesForFilter('bounces')).toEqual(
      expect.arrayContaining(['hardBounces', 'softBounces', 'bounces'])
    )
  })

  it('maps unique_opened without collapsing to all opens', () => {
    expect(mongoEventValuesForFilter('unique_opened')).toEqual([
      'unique_opened',
      'uniqueopened',
      'firstopening'
    ])
    expect(mongoEventValuesForFilter('opened')).toEqual(
      expect.arrayContaining(['opened', 'unique_opened'])
    )
  })
})
