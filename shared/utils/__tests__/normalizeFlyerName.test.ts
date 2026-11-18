import { describe, expect, it } from 'vitest'
import { normalizeFlyerName } from '../normalizeFlyerName'

describe('normalizeFlyerName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeFlyerName('  Spring  Promo  ')).toBe('Spring Promo')
  })
})
