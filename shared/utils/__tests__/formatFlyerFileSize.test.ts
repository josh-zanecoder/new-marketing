import { describe, expect, it } from 'vitest'
import { formatFlyerFileSize } from '../formatFlyerFileSize'

describe('formatFlyerFileSize', () => {
  it('formats bytes, KB, and MB', () => {
    expect(formatFlyerFileSize(512)).toBe('512 B')
    expect(formatFlyerFileSize(2048)).toBe('2.0 KB')
    expect(formatFlyerFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })

  it('returns empty for invalid sizes', () => {
    expect(formatFlyerFileSize(Number.NaN)).toBe('')
    expect(formatFlyerFileSize(-1)).toBe('')
  })
})
