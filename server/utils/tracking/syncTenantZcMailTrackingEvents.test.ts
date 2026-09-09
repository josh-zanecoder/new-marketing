import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TENANT_EMAIL_PROVIDER_ZC_MAIL } from '@server/constants/emailProvider'
import { syncTenantZcMailTrackingEvents } from './syncTenantZcMailTrackingEvents'

const {
  findEmailMessageRoutingMap,
  ensureBrevoTrackingIndexes,
  dedupeBrevoTrackingEvents,
  bulkWrite,
  updateMany,
  trackingFind,
  recipientFind
} = vi.hoisted(() => {
  const trackingFind = vi.fn(() => ({
    select: () => ({
      lean: () => ({
        exec: async () => []
      })
    })
  }))
  const recipientFind = vi.fn(() => ({
    select: () => ({
      lean: () => ({
        exec: async () => [
          { brevoMessageId: 'msg-1' },
          { brevoMessageId: 'msg-2' },
          { brevoMessageId: 'msg-3' }
        ]
      })
    })
  }))
  return {
    findEmailMessageRoutingMap: vi.fn(async () => new Map()),
    ensureBrevoTrackingIndexes: vi.fn(async () => undefined),
    dedupeBrevoTrackingEvents: vi.fn(async () => ({ removed: 0 })),
    bulkWrite: vi.fn(async () => ({ upsertedCount: 0, modifiedCount: 0 })),
    updateMany: vi.fn(async () => ({ acknowledged: true })),
    trackingFind,
    recipientFind
  }
})

vi.mock('@server/tenant/connection', () => ({
  getTenantConnectionByDbName: vi.fn(async () => ({}))
}))

vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: vi.fn(() => ({
    BrevoTrackingEvent: {
      find: trackingFind,
      bulkWrite,
      updateMany
    },
    CampaignRecipient: {
      find: recipientFind
    }
  }))
}))

vi.mock('@server/utils/zcmail/emailMessageRouting', () => ({
  findEmailMessageRoutingMap
}))

vi.mock('@server/utils/tracking/dedupeBrevoTrackingEvents', () => ({
  ensureBrevoTrackingIndexes,
  dedupeBrevoTrackingEvents
}))

vi.mock('@server/utils/zcmail/zcMailArchiveClient', () => ({
  listZcMailArchive: vi.fn(),
  getZcMailArchiveById: vi.fn()
}))

describe('syncTenantZcMailTrackingEvents performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findEmailMessageRoutingMap.mockResolvedValue(new Map())
    dedupeBrevoTrackingEvents.mockResolvedValue({ removed: 0 })
  })

  it('lists archives by campaign only — not once per recipient message id', async () => {
    const listCalls: Array<{ q?: string; campaign?: string }> = []
    const list = vi.fn(async (params: { q?: string; campaign?: string }) => {
      listCalls.push({ q: params.q, campaign: params.campaign })
      return {
        total: 1,
        items: [
          {
            id: 'arc-1',
            messageId: 'msg-1',
            sesMessageId: 'msg-1',
            to: ['a@example.com'],
            from: 'from@example.com',
            subject: 'Hi',
            tenantName: 't',
            recipient: 'a@example.com',
            status: 'delivered',
            createdAt: '2026-09-01T12:00:00.000Z',
            tags: { campaign: 'camp-1', db: 'tenant_db', source: 'new-marketing-campaign' }
          }
        ]
      }
    })
    const getById = vi.fn(async () => ({
      id: 'arc-1',
      messageId: 'msg-1',
      sesMessageId: 'msg-1',
      to: ['a@example.com'],
      from: 'from@example.com',
      subject: 'Hi',
      tenantName: 't',
      recipient: 'a@example.com',
      status: 'delivered',
      createdAt: '2026-09-01T12:00:00.000Z',
      tags: { campaign: 'camp-1', db: 'tenant_db', source: 'new-marketing-campaign' },
      events: []
    }))

    await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-01',
      toYmd: '2026-09-01',
      config: {
        provider: TENANT_EMAIL_PROVIDER_ZC_MAIL,
        apiKey: 'key',
        zcMailBaseUrl: 'https://example.test',
        zcMailTenant: 't',
        zcMailArchive: true
      },
      archiveClient: { list, getById }
    })

    // 1 campaign-scoped list + 2 search-term lists (id, campaign:id) — not 3 recipient ids.
    expect(listCalls.length).toBeLessThanOrEqual(3)
    expect(listCalls.every((c) => c.campaign === 'camp-1')).toBe(true)
    expect(listCalls.some((c) => c.q === 'msg-1' || c.q === 'msg-2' || c.q === 'msg-3')).toBe(
      false
    )
  })

  it('falls back to tenant archive list when campaign filter returns empty', async () => {
    const listCalls: Array<{ q?: string; campaign?: string }> = []
    const list = vi.fn(async (params: { q?: string; campaign?: string }) => {
      listCalls.push({ q: params.q, campaign: params.campaign })
      if (params.campaign) {
        return { total: 0, items: [] }
      }
      return {
        total: 1,
        items: [
          {
            id: 'arc-1',
            messageId: 'msg-1',
            sesMessageId: 'msg-1',
            to: ['a@example.com'],
            from: 'from@example.com',
            subject: 'A quick note from Santiago',
            tenantName: 't',
            recipient: 'a@example.com',
            status: 'sent',
            createdAt: '2026-09-01T12:00:00.000Z'
            // no tags — scoped via CampaignRecipient brevoMessageId
          }
        ]
      }
    })
    const getById = vi.fn(async (item: { archiveId: string }) => ({
      id: item.archiveId,
      messageId: 'msg-1',
      sesMessageId: 'msg-1',
      to: ['a@example.com'],
      from: 'from@example.com',
      subject: 'A quick note from Santiago',
      tenantName: 't',
      recipient: 'a@example.com',
      status: 'sent',
      createdAt: '2026-09-01T12:00:00.000Z',
      events: []
    }))

    const result = await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-01',
      toYmd: '2026-09-01',
      config: {
        provider: TENANT_EMAIL_PROVIDER_ZC_MAIL,
        apiKey: 'key',
        zcMailBaseUrl: 'https://example.test',
        zcMailTenant: 't',
        zcMailArchive: true
      },
      archiveClient: { list, getById }
    })

    expect(listCalls.some((c) => !c.campaign)).toBe(true)
    expect(result.fetched).toBeGreaterThan(0)
  })
})
