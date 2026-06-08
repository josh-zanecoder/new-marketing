import { describe, expect, it, vi } from 'vitest'
import {
  countAllMarketableContactsByType,
  countMarketableContactsByTypeKey
} from '../contactCountsByType'

describe('contactCountsByType', () => {
  it('countMarketableContactsByTypeKey fills zeros and applies aggregation rows', async () => {
    const Contact = {
      aggregate: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          { _id: 'prospect', count: 4 },
          { _id: 'CLIENT', count: 2 }
        ])
      })
    }

    const counts = await countMarketableContactsByTypeKey({
      Contact: Contact as never,
      contactFilter: { deletedAt: null },
      countKeys: ['client', 'prospect']
    })

    expect(counts).toEqual({ client: 2, prospect: 4 })
    expect(Contact.aggregate).toHaveBeenCalledOnce()
  })

  it('countAllMarketableContactsByType returns every grouped key', async () => {
    const Contact = {
      aggregate: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          { _id: 'prospect', count: 9 },
          { _id: 'partner', count: 1 }
        ])
      })
    }

    const counts = await countAllMarketableContactsByType({
      Contact: Contact as never,
      contactFilter: { deletedAt: null }
    })

    expect(counts).toEqual({ prospect: 9, partner: 1 })
  })
})
