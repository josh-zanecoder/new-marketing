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

  it('paginates until a short page and requests 90 days by default', async () => {
    const page1 = Array.from({ length: 2500 }, (_, i) => ({
      messageId: `m${i}`,
      event: 'delivered',
      tag: 'db:tenant_a'
    }))
    const page2 = [
      { messageId: 'tail', event: 'opened', tag: 'db:tenant_a' },
      { messageId: 'tail2', event: 'clicks', tag: 'db:tenant_a' }
    ]

    getReport
      .mockResolvedValueOnce({ report: { events: page1 } })
      .mockResolvedValueOnce({ report: { events: page2 } })

    const { events, error } = await fetchTenantBrevoEmailEvents({ dbName: 'tenant_a' })

    expect(error).toBeUndefined()
    expect(events).toHaveLength(2502)
    expect(getReport).toHaveBeenCalledTimes(2)
    expect(getReport.mock.calls[0]?.[0]).toMatchObject({
      days: 90,
      limit: 2500,
      offset: 0,
      sort: 'desc'
    })
    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('tags')
    expect(getReport.mock.calls[1]?.[0]).toMatchObject({
      days: 90,
      offset: 2500
    })
  })

  it('passes an explicit Brevo tags filter when provided', async () => {
    getReport.mockResolvedValueOnce({ report: { events: [] } })

    await fetchTenantBrevoEmailEvents({
      tags: JSON.stringify(['db:tenant_a'])
    })

    expect(getReport.mock.calls[0]?.[0]).toMatchObject({
      days: 90,
      tags: JSON.stringify(['db:tenant_a'])
    })
  })
})
