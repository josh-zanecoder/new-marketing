import { describe, expect, it, vi } from 'vitest'
import { findUnsubscribedNormalizedEmails } from './marketableContact'

describe('findUnsubscribedNormalizedEmails', () => {
  it('returns normalized emails for unsubscribed contacts', async () => {
    const find = vi.fn().mockReturnValue({
      select: () => ({
        lean: async () => [{ email: 'Ada@Example.COM' }, { email: 'bob@example.com' }]
      })
    })
    const set = await findUnsubscribedNormalizedEmails(
      { find } as never,
      ['ada@example.com', 'other@example.com', '']
    )
    expect(find).toHaveBeenCalledWith({
      email: { $in: ['ada@example.com', 'other@example.com'] },
      isUnsubscribe: true,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    })
    expect([...set].sort()).toEqual(['ada@example.com', 'bob@example.com'])
  })

  it('returns empty set when no emails', async () => {
    const find = vi.fn()
    const set = await findUnsubscribedNormalizedEmails({ find } as never, ['', '  '])
    expect(find).not.toHaveBeenCalled()
    expect(set.size).toBe(0)
  })
})
