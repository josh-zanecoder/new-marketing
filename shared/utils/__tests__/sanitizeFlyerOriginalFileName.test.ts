import { describe, expect, it } from 'vitest'
import { sanitizeFlyerOriginalFileName } from '../sanitizeFlyerOriginalFileName'

describe('sanitizeFlyerOriginalFileName', () => {
  it('strips path separators and trims', () => {
    expect(sanitizeFlyerOriginalFileName('  folder/SASWEEK 13.pdf  ')).toBe('SASWEEK 13.pdf')
  })

  it('returns empty for blank input', () => {
    expect(sanitizeFlyerOriginalFileName('')).toBe('')
    expect(sanitizeFlyerOriginalFileName(null)).toBe('')
  })
})
