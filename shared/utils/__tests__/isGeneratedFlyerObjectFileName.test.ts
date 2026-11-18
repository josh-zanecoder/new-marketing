import { describe, expect, it } from 'vitest'
import { isGeneratedFlyerObjectFileName } from '../isGeneratedFlyerObjectFileName'

describe('isGeneratedFlyerObjectFileName', () => {
  it('detects GCS-style object names', () => {
    expect(
      isGeneratedFlyerObjectFileName('17635021264797-2d1f99c0-8f3a-4b2e-9c1d-abc.pdf')
    ).toBe(true)
  })

  it('allows human original names', () => {
    expect(isGeneratedFlyerObjectFileName('SASWEEK 13.pdf')).toBe(false)
    expect(isGeneratedFlyerObjectFileName('Christmas Promo.pdf')).toBe(false)
  })
})
