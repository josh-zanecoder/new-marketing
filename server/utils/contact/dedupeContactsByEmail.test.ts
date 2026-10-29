import { describe, expect, it } from 'vitest'
import { dedupeContactsByEmail } from './dedupeContactsByEmail'

describe('dedupeContactsByEmail', () => {
  it('keeps one row per email and the newest copy', () => {
    const rows = dedupeContactsByEmail([
      {
        id: 'new',
        email: 'Alice@Mailinator.com',
        name: 'Alice Firstimer',
        updatedAt: '2026-10-02T00:00:00.000Z',
        is_unsubscribe: false
      },
      {
        id: 'old',
        email: 'alice@mailinator.com',
        name: 'Alice Firstimer',
        updatedAt: '2026-09-01T00:00:00.000Z',
        is_unsubscribe: false
      },
      {
        id: 'other',
        email: 'bob@example.com',
        name: 'Bob',
        updatedAt: '2026-10-01T00:00:00.000Z',
        is_unsubscribe: false
      }
    ])

    expect(rows.map((row) => row.id)).toEqual(['new', 'other'])
  })

  it('marks the row unsubscribed when any copy opted out', () => {
    const rows = dedupeContactsByEmail([
      {
        id: 'new',
        email: 'alice@mailinator.com',
        updatedAt: '2026-10-02T00:00:00.000Z',
        is_unsubscribe: false
      },
      {
        id: 'old',
        email: 'alice@mailinator.com',
        updatedAt: '2026-09-01T00:00:00.000Z',
        is_unsubscribe: true
      }
    ])

    expect(rows).toEqual([
      expect.objectContaining({ id: 'new', is_unsubscribe: true })
    ])
  })

  it('keeps rows that have no email', () => {
    const rows = dedupeContactsByEmail([
      { id: 'a', email: '', updatedAt: '2026-10-02T00:00:00.000Z' },
      { id: 'b', email: '  ', updatedAt: '2026-10-01T00:00:00.000Z' }
    ])
    expect(rows.map((row) => row.id)).toEqual(['a', 'b'])
  })
})
