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

  it('uses comma-style campaign tag and pages clicks with limit 5000', async () => {
    getReport.mockImplementation(async (req) => {
      if (req?.event === 'clicks' && req?.tags === 'campaign:6a689f1c8c900ea63a4d8de8') {
        return {
          report: {
            events: Array.from({ length: 350 }, (_, i) => ({
              messageId: `m${i}`,
              event: 'clicks',
              date: `2026-07-29T12:${String(i % 60).padStart(2, '0')}:00.000Z`,
              email: `u${i}@example.com`,
              tag: 'campaign:6a689f1c8c900ea63a4d8de8'
            }))
          }
        }
      }
      return { report: { events: [] } }
    })

    const { events, error } = await fetchTenantBrevoEmailEvents({
      dbName: 'forge_capital_lending_db',
      campaignId: '6a689f1c8c900ea63a4d8de8'
    })

    expect(error).toBeUndefined()
    expect(events.filter((e) => e.event === 'clicks')).toHaveLength(350)

    const clickCall = getReport.mock.calls.find((c) => c[0]?.event === 'clicks')
    expect(clickCall?.[0]).toMatchObject({
      days: 90,
      limit: 5000,
      offset: 0,
      sort: 'desc',
      tags: 'campaign:6a689f1c8c900ea63a4d8de8',
      event: 'clicks'
    })
  })

  it('falls back without tags when scoped queries are empty', async () => {
    getReport.mockImplementation(async (req) => {
      if (!req?.tags) {
        return {
          report: {
            events: [{ messageId: 'a', event: 'opened', tag: 'db:tenant_a' }]
          }
        }
      }
      return { report: { events: [] } }
    })

    const { events } = await fetchTenantBrevoEmailEvents({ dbName: 'tenant_a' })
    expect(events).toHaveLength(1)
  })

  it('skips Brevo tags filter when tags is empty string', async () => {
    getReport.mockResolvedValueOnce({ report: { events: [] } })

    await fetchTenantBrevoEmailEvents({ tags: '' })

    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('tags')
    expect(getReport.mock.calls[0]?.[0]).not.toHaveProperty('event')
    expect(getReport).toHaveBeenCalledTimes(1)
  })
})
