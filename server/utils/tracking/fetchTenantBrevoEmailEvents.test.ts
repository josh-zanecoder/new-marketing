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

  it('paginates and scopes Brevo by campaign tag when campaignId is set', async () => {
    const page1 = Array.from({ length: 2500 }, (_, i) => ({
      messageId: `m${i}`,
      event: 'requests',
      tag: 'campaign:6a689f1c8c900ea63a4d8de8'
    }))
    const page2 = [
      { messageId: 'tail', event: 'opened', tag: 'campaign:6a689f1c8c900ea63a4d8de8' }
    ]

    getReport
      .mockResolvedValueOnce({ report: { events: page1 } })
      .mockResolvedValueOnce({ report: { events: page2 } })

    const { events, error } = await fetchTenantBrevoEmailEvents({
      dbName: 'forge_capital_lending_db',
      campaignId: '6a689f1c8c900ea63a4d8de8'
    })

    expect(error).toBeUndefined()
    expect(events).toHaveLength(2501)
    expect(getReport.mock.calls[0]?.[0]).toMatchObject({
      days: 90,
      limit: 2500,
      offset: 0,
      sort: 'desc',
      tags: JSON.stringify(['campaign:6a689f1c8c900ea63a4d8de8'])
    })
  })

  it('scopes by db tag when no campaignId', async () => {
    getReport.mockResolvedValueOnce({ report: { events: [] } })
    // empty with tags → fallback without tags
    getReport.mockResolvedValueOnce({
      report: {
        events: [{ messageId: 'a', event: 'opened', tag: 'db:tenant_a' }]
      }
    })

    const { events } = await fetchTenantBrevoEmailEvents({ dbName: 'tenant_a' })

    expect(getReport.mock.calls[0]?.[0]).toMatchObject({
      tags: JSON.stringify(['db:tenant_a'])
    })
    expect(getReport.mock.calls[1]?.[0]).not.toHaveProperty('tags')
    expect(events).toHaveLength(1)
  })

  it('skips Brevo tags filter when tags is empty string', async () => {
    getReport.mockResolvedValueOnce({ report: { events: [] } })

    await fetchTenantBrevoEmailEvents({ tags: '' })

    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('tags')
    expect(getReport).toHaveBeenCalledTimes(1)
  })
})
