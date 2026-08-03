import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getAggregatedSmtpReport,
  getSmtpDailyReport,
  getTransactionalEmailEventReport
} from '@server/services/brevo.service'
import {
  buildBrevoSmtpStatsCacheKey,
  clampBrevoSmtpDateRange,
  clampBrevoSmtpStatsRangeToMaxDays,
  clearBrevoSmtpStatsInflightForTests,
  fetchBrevoTransactionalStats
} from './fetchBrevoTransactionalStats'

const findOne = vi.fn()
const updateOne = vi.fn()

vi.mock('@server/services/brevo.service', () => ({
  getAggregatedSmtpReport: vi.fn(),
  getSmtpDailyReport: vi.fn(),
  getTransactionalEmailEventReport: vi.fn()
}))

vi.mock('@server/tenant/connection', () => ({
  getTenantConnectionByDbName: vi.fn(async () => ({}))
}))

vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: vi.fn(() => ({
    BrevoSmtpStatsCache: {
      findOne: () => ({
        lean: () => ({
          exec: () => findOne()
        })
      }),
      updateOne: (...args: unknown[]) => ({
        exec: () => updateOne(...args)
      })
    }
  }))
}))

const getAgg = vi.mocked(getAggregatedSmtpReport)
const getDaily = vi.mocked(getSmtpDailyReport)
const getEvents = vi.mocked(getTransactionalEmailEventReport)

function mockLiveBrevoOk() {
  getAgg.mockResolvedValue({
    report: {
      requests: 10,
      delivered: 8,
      hardBounces: 0,
      softBounces: 0,
      opens: 3,
      uniqueOpens: 2,
      clicks: 1,
      uniqueClicks: 1,
      blocked: 0,
      invalid: 0,
      spamReports: 0,
      unsubscribed: 0
    }
  })
  getDaily.mockResolvedValue({
    report: {
      reports: [
        {
          date: '2026-07-30',
          requests: 10,
          delivered: 8,
          hardBounces: 0,
          softBounces: 0,
          opens: 3,
          uniqueOpens: 2,
          clicks: 1,
          uniqueClicks: 1,
          blocked: 0,
          invalid: 0,
          spamReports: 0,
          unsubscribed: 0
        }
      ]
    }
  })
  getEvents.mockResolvedValue({
    report: {
      events: [
        {
          email: 'a@example.com',
          date: '2026-07-30T12:00:00.000Z',
          subject: 'Hi',
          messageId: 'm1',
          event: 'delivered',
          from: 'from@example.com'
        }
      ]
    }
  })
}

describe('clampBrevoSmtpDateRange', () => {
  it('clamps endDate to UTC today', () => {
    const now = new Date('2026-08-02T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-07-25', '2026-08-10', now)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-08-02'
    })
  })

  it('pulls start forward when after end', () => {
    const now = new Date('2026-08-02T12:00:00.000Z')
    expect(clampBrevoSmtpDateRange('2026-08-05', '2026-08-01', now)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-01'
    })
  })
})

describe('clampBrevoSmtpStatsRangeToMaxDays', () => {
  it('leaves short ranges unchanged', () => {
    expect(clampBrevoSmtpStatsRangeToMaxDays('2026-07-25', '2026-07-31', 30)).toEqual({
      startDate: '2026-07-25',
      endDate: '2026-07-31'
    })
  })

  it('pulls start forward when span exceeds max inclusive days', () => {
    expect(clampBrevoSmtpStatsRangeToMaxDays('2026-06-01', '2026-07-31', 30)).toEqual({
      startDate: '2026-07-02',
      endDate: '2026-07-31'
    })
  })
})

describe('fetchBrevoTransactionalStats cache', () => {
  beforeEach(() => {
    findOne.mockReset()
    updateOne.mockReset()
    getAgg.mockReset()
    getDaily.mockReset()
    getEvents.mockReset()
    clearBrevoSmtpStatsInflightForTests()
    findOne.mockResolvedValue(null)
    updateOne.mockResolvedValue({ acknowledged: true })
  })

  afterEach(() => {
    clearBrevoSmtpStatsInflightForTests()
  })

  it('builds a stable cache key', () => {
    expect(
      buildBrevoSmtpStatsCacheKey({
        dbName: 'tenant_db',
        campaignId: 'abc',
        userEmail: null,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        eventType: null,
        eventsLimit: 10,
        eventsOffset: 0
      })
    ).toBe('tenant_db|abc|-|2026-07-01|2026-07-31|-|10|0|v1')
  })

  it('returns cached stats without calling Brevo on cache hit', async () => {
    const cachedStats = {
      range: { startDate: '2026-07-25', endDate: '2026-07-31' },
      tag: 'campaign:abc',
      aggregated: {
        requests: 5,
        delivered: 4,
        hardBounces: 0,
        softBounces: 0,
        opens: 1,
        uniqueOpens: 1,
        clicks: 0,
        uniqueClicks: 0,
        blocked: 0,
        invalid: 0,
        spamReports: 0,
        unsubscribed: 0,
        rates: {
          deliveredPct: 80,
          uniqueOpensPct: 20,
          opensPct: 20,
          uniqueClicksPct: 0,
          hardBouncesPct: 0,
          softBouncesPct: 0,
          blockedPct: 0,
          invalidPct: 0,
          spamReportsPct: 0,
          unsubscribedPct: 0
        }
      },
      daily: [],
      events: { items: [], limit: 10, offset: 0, hasMore: false }
    }
    findOne.mockResolvedValue({
      stats: cachedStats,
      fetchedAt: new Date()
    })

    const { stats, error } = await fetchBrevoTransactionalStats({
      dbName: 'tenant_db',
      campaignId: 'abc',
      startDate: '2026-07-25',
      endDate: '2026-07-31'
    })

    expect(error).toBeUndefined()
    expect(stats?.aggregated.requests).toBe(5)
    expect(getAgg).not.toHaveBeenCalled()
    expect(getDaily).not.toHaveBeenCalled()
    expect(getEvents).not.toHaveBeenCalled()
    expect(updateOne).not.toHaveBeenCalled()
  })

  it('fetches Brevo and upserts cache on miss', async () => {
    mockLiveBrevoOk()

    const { stats, error } = await fetchBrevoTransactionalStats({
      dbName: 'tenant_db',
      campaignId: 'abc',
      startDate: '2026-07-25',
      endDate: '2026-07-31'
    })

    expect(error).toBeUndefined()
    expect(stats?.aggregated.requests).toBe(10)
    expect(getAgg).toHaveBeenCalledTimes(1)
    expect(getDaily).toHaveBeenCalledTimes(1)
    expect(getEvents).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledTimes(1)
    const updateArgs = updateOne.mock.calls[0]
    expect(updateArgs?.[0]).toEqual({
      cacheKey: 'tenant_db|abc|-|2026-07-25|2026-07-31|-|10|0|v1'
    })
    expect(updateArgs?.[1]).toMatchObject({
      $set: {
        cacheKey: 'tenant_db|abc|-|2026-07-25|2026-07-31|-|10|0|v1'
      }
    })
  })

  it('skipCache forces Brevo even when Mongo has a fresh entry', async () => {
    findOne.mockResolvedValue({
      stats: {
        range: { startDate: '2026-07-25', endDate: '2026-07-31' },
        tag: 'campaign:abc',
        aggregated: {
          requests: 99,
          delivered: 99,
          hardBounces: 0,
          softBounces: 0,
          opens: 0,
          uniqueOpens: 0,
          clicks: 0,
          uniqueClicks: 0,
          blocked: 0,
          invalid: 0,
          spamReports: 0,
          unsubscribed: 0,
          rates: {
            deliveredPct: 100,
            uniqueOpensPct: 0,
            opensPct: 0,
            uniqueClicksPct: 0,
            hardBouncesPct: 0,
            softBouncesPct: 0,
            blockedPct: 0,
            invalidPct: 0,
            spamReportsPct: 0,
            unsubscribedPct: 0
          }
        },
        daily: [],
        events: { items: [], limit: 10, offset: 0, hasMore: false }
      },
      fetchedAt: new Date()
    })
    mockLiveBrevoOk()

    const { stats, error } = await fetchBrevoTransactionalStats({
      dbName: 'tenant_db',
      campaignId: 'abc',
      startDate: '2026-07-25',
      endDate: '2026-07-31',
      skipCache: true
    })

    expect(error).toBeUndefined()
    expect(stats?.aggregated.requests).toBe(10)
    expect(findOne).not.toHaveBeenCalled()
    expect(getAgg).toHaveBeenCalledTimes(1)
    expect(updateOne).toHaveBeenCalledTimes(1)
  })

  it('treats expired Mongo docs as a miss', async () => {
    findOne.mockResolvedValue({
      stats: {
        range: { startDate: '2026-07-25', endDate: '2026-07-31' },
        tag: 'campaign:abc',
        aggregated: {
          requests: 1,
          delivered: 1,
          hardBounces: 0,
          softBounces: 0,
          opens: 0,
          uniqueOpens: 0,
          clicks: 0,
          uniqueClicks: 0,
          blocked: 0,
          invalid: 0,
          spamReports: 0,
          unsubscribed: 0,
          rates: {
            deliveredPct: 100,
            uniqueOpensPct: 0,
            opensPct: 0,
            uniqueClicksPct: 0,
            hardBouncesPct: 0,
            softBouncesPct: 0,
            blockedPct: 0,
            invalidPct: 0,
            spamReportsPct: 0,
            unsubscribedPct: 0
          }
        },
        daily: [],
        events: { items: [], limit: 10, offset: 0, hasMore: false }
      },
      fetchedAt: new Date(Date.now() - 10 * 60_000)
    })
    mockLiveBrevoOk()

    const { stats } = await fetchBrevoTransactionalStats({
      dbName: 'tenant_db',
      campaignId: 'abc',
      startDate: '2026-07-25',
      endDate: '2026-07-31'
    })

    expect(stats?.aggregated.requests).toBe(10)
    expect(getAgg).toHaveBeenCalledTimes(1)
  })
})
