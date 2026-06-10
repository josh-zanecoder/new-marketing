import { describe, expect, it, vi } from 'vitest'
import { contactsByEmailForAudience } from '../campaignAudience'

describe('contactsByEmailForAudience batch optimization', () => {
  it('does not load full list membership when batch emails are provided', async () => {
    const find = vi.fn(() => ({
      lean: async () => [{ _id: '1', email: 'a@test.com' }]
    }))
    const memberFind = vi.fn(async () => {
      throw new Error('should not load full list for batch sends')
    })

    const models = {
      Contact: { find },
      RecipientListMember: { find: memberFind }
    }

    const map = await contactsByEmailForAudience(
      models as never,
      { recipientsType: 'list', recipientsListId: '507f1f77bcf86cd799439011' },
      ['a@test.com']
    )

    expect(map.size).toBe(1)
    expect(memberFind).not.toHaveBeenCalled()
    expect(find).toHaveBeenCalledTimes(1)
  })
})
