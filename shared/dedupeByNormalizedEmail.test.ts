import { describe, expect, it } from 'vitest'
import {
  dedupeByNormalizedEmailKeepFirst,
  normalizeRecipientEmailKey
} from './dedupeByNormalizedEmail'

describe('normalizeRecipientEmailKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeRecipientEmailKey('  Ken@Mail.com ')).toBe('ken@mail.com')
  })
})

describe('dedupeByNormalizedEmailKeepFirst', () => {
  it('keeps the first row for each email', () => {
    const rows = [
      { id: '1', email: 'ken@mailinator.com' },
      { id: '2', email: 'other@example.com' },
      { id: '3', email: 'Ken@Mailinator.com' }
    ]
    expect(dedupeByNormalizedEmailKeepFirst(rows).map((r) => r.id)).toEqual(['1', '2'])
  })

  it('keeps rows without a valid email separately', () => {
    const rows = [
      { id: 'a', email: '' },
      { id: 'b', email: 'ok@x.com' },
      { id: 'c', email: '   ' }
    ]
    expect(dedupeByNormalizedEmailKeepFirst(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})
