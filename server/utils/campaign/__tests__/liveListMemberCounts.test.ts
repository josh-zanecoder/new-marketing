/* eslint-disable import/first -- vi.mock must precede the imports it replaces */
import { describe, expect, it, vi } from 'vitest'
import type { Connection } from 'mongoose'
import { LIVE_AUDIENCE_PROTECTED_STATUSES } from '~~/shared/campaignAdvancedRecipientFilters'

const aggregate = vi.fn()
vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: () => ({ RecipientListMember: { aggregate } })
}))

import { liveListMemberCounts } from '../liveListMemberCounts'

const LIST_A = '65f0c0ffee0000000000aaaa'
const LIST_B = '65f0c0ffee0000000000bbbb'
const conn = {} as Connection

describe('liveListMemberCounts', () => {
  it('skips the database when no campaign is live-list', async () => {
    aggregate.mockClear()
    const out = await liveListMemberCounts(conn, [
      { recipientsType: 'list', recipientsListId: LIST_A, liveListAudience: false },
      { recipientsType: 'manual', recipientsListId: '', liveListAudience: false }
    ])
    expect(out.size).toBe(0)
    expect(aggregate).not.toHaveBeenCalled()
  })

  it('queries each live list once and maps counts by list id', async () => {
    aggregate.mockReset()
    aggregate.mockResolvedValue([
      { _id: LIST_A, n: 12 },
      { _id: LIST_B, n: 3 }
    ])
    const out = await liveListMemberCounts(conn, [
      { recipientsType: 'list', recipientsListId: LIST_A, liveListAudience: true },
      { recipientsType: 'list', recipientsListId: LIST_A, liveListAudience: true },
      { recipientsType: 'list', recipientsListId: LIST_B, liveListAudience: true },
      { recipientsType: 'list', recipientsListId: '65f0c0ffee0000000000cccc', liveListAudience: false }
    ])
    expect(aggregate).toHaveBeenCalledTimes(1)
    const match = aggregate.mock.calls[0][0][0].$match.recipientListId.$in
    expect(match).toHaveLength(2)
    expect(out.get(LIST_A)).toBe(12)
    expect(out.get(LIST_B)).toBe(3)
  })
})

describe('LIVE_AUDIENCE_PROTECTED_STATUSES', () => {
  it('protects lists of unsent campaigns but not finished ones', () => {
    expect(LIVE_AUDIENCE_PROTECTED_STATUSES).toEqual(['Draft', 'Scheduled', 'Sending', 'Paused'])
    expect(LIVE_AUDIENCE_PROTECTED_STATUSES).not.toContain('Sent')
  })
})
