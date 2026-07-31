import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import {
  clearBrevoEmailEventsCacheForTests,
  fetchTenantBrevoEmailEvents
} from './fetchTenantBrevoEmailEvents'

vi.mock('@server/services/brevo.service', () => ({
  getTransactionalEmailEventReport: vi.fn()
}))

const getReport = vi.mocked(getTransactionalEmailEventReport)

describe('fetchTenantBrevoEmailEvents', () => {
  afterEach(() => {
    clearBrevoEmailEventsCacheForTests()
    getReport.mockReset()
  })

  it('paginates a single tagged walk with limit 5000 (rate-limit safe)', async () => {
    getReport
      .mockResolvedValueOnce({
        report: {
          events: Array.from({ length: 5000 }, (_, i) => ({
            messageId: `m${i}`,
            event: 'requests',
            tag: 'campaign:6a6a5af2aa7754831b29b296'
          }))
        }
      })
      .mockResolvedValueOnce({
        report: {
          events: [
            {
              messageId: 'tail',
              event: 'clicks',
              tag: 'campaign:6a6a5af2aa7754831b29b296'
            }
          ]
        }
      })

    const { events, error } = await fetchTenantBrevoEmailEvents({
      dbName: 'forge_capital_lending_db',
      campaignId: '6a6a5af2aa7754831b29b296'
    })

    expect(error).toBeUndefined()
    expect(events).toHaveLength(5001)
    expect(getReport).toHaveBeenCalledTimes(2)
    expect(getReport.mock.calls[0]?.[0]).toMatchObject({
      days: 90,
      limit: 5000,
      offset: 0,
      sort: 'desc',
      tags: 'campaign:6a6a5af2aa7754831b29b296'
    })
    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('event')
  })

  it('skips Brevo tags filter when tags is empty string', async () => {
    getReport.mockResolvedValueOnce({ report: { events: [] } })

    await fetchTenantBrevoEmailEvents({ tags: '' })

    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('tags')
    expect(getReport).toHaveBeenCalledTimes(1)
  })
})
