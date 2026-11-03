import { describe, expect, it } from 'vitest'
import {
  dedupeByNormalizedEmailKeepFirst,
  normalizeRecipientEmailKey
} from '../dedupeByNormalizedEmail'

describe('normalizeRecipientEmailKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeRecipientEmailKey('  Ken@Mailinator.COM ')).toBe('ken@mailinator.com')
  })
})

describe('dedupeByNormalizedEmailKeepFirst', () => {
  it('keeps the first contact for each email', () => {
    const rows = [
      { id: '1', name: 'Ken A', email: 'ken@mailinator.com' },
      { id: '2', name: 'Other', email: 'other@x.com' },
      { id: '3', name: 'Ken B', email: 'KEN@mailinator.com' },
      { id: '4', name: 'Ken C', email: 'ken@mailinator.com' }
    ]
    expect(dedupeByNormalizedEmailKeepFirst(rows).map((r) => r.id)).toEqual(['1', '2'])
  })

  it('keeps blank-email rows separately by id', () => {
    const rows = [
      { id: 'a', email: '' },
      { id: 'b', email: '   ' },
      { id: 'c', email: 'ok@x.com' }
    ]
    expect(dedupeByNormalizedEmailKeepFirst(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})
