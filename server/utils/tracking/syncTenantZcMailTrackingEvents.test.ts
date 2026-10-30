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
      updateMany,
      deleteMany: vi.fn(async () => ({ deletedCount: 0 }))
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

const zcMailConfig = {
  provider: TENANT_EMAIL_PROVIDER_ZC_MAIL,
  apiKey: 'key',
  zcMailBaseUrl: 'https://example.test',
  zcMailTenant: 't',
  zcMailArchive: true
} as const

function archiveItem(overrides: Record<string, unknown>) {
  return {
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
    ...overrides
  }
}

describe('syncTenantZcMailTrackingEvents performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findEmailMessageRoutingMap.mockResolvedValue(new Map())
    dedupeBrevoTrackingEvents.mockResolvedValue({ removed: 0 })
  })

  it('uses campaign/tag archive list when it covers all recipients — no per-id q fan-out', async () => {
    const listCalls: Array<{ q?: string; campaign?: string }> = []
    const list = vi.fn(async (params: { q?: string; campaign?: string }) => {
      listCalls.push({ q: params.q, campaign: params.campaign })
      if (!params.campaign && !params.q) return { total: 0, items: [] }
      return {
        total: 3,
        items: [
          archiveItem({ id: 'arc-1', messageId: 'msg-1', sesMessageId: 'msg-1' }),
          archiveItem({ id: 'arc-2', messageId: 'msg-2', sesMessageId: 'msg-2' }),
          archiveItem({ id: 'arc-3', messageId: 'msg-3', sesMessageId: 'msg-3' })
        ]
      }
    })
    const getById = vi.fn(async (item: { archiveId: string }) => ({
      ...archiveItem({ id: item.archiveId }),
      events: []
    }))

    const result = await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-01',
      toYmd: '2026-09-01',
      config: { ...zcMailConfig },
      archiveClient: { list, getById }
    })

    expect(result.debug?.usedMessageIdBackfill).toBe(false)
    expect(listCalls.some((c) => c.campaign === 'camp-1')).toBe(true)
    expect(listCalls.every((c) => c.q !== 'msg-1' && c.q !== 'msg-2' && c.q !== 'msg-3')).toBe(
      true
    )
    expect(result.fetched).toBeGreaterThan(0)
  })

  it('falls back to message-id q when campaign filter returns empty', async () => {
    const listCalls: Array<{ q?: string; campaign?: string }> = []
    const list = vi.fn(async (params: { q?: string; campaign?: string }) => {
      listCalls.push({ q: params.q, campaign: params.campaign })
      if (params.campaign) {
        return { total: 0, items: [] }
      }
      if (params.q === 'msg-1' || params.q === 'msg-2' || params.q === 'msg-3') {
        return {
          total: 1,
          items: [
            archiveItem({
              id: `arc-${params.q}`,
              messageId: params.q,
              sesMessageId: params.q,
              subject: 'A quick note from Santiago',
              status: 'sent',
              tags: undefined
            })
          ]
        }
      }
      return { total: 0, items: [] }
    })
    const getById = vi.fn(async (item: { archiveId: string }) => ({
      ...archiveItem({ id: item.archiveId, status: 'sent', subject: 'A quick note from Santiago' }),
      events: []
    }))

    const result = await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-01',
      toYmd: '2026-09-01',
      config: { ...zcMailConfig },
      archiveClient: { list, getById }
    })

    expect(listCalls.some((c) => c.campaign === 'camp-1')).toBe(true)
    expect(listCalls.some((c) => c.q === 'msg-1')).toBe(true)
    expect(result.debug?.usedMessageIdBackfill).toBe(true)
    expect(result.fetched).toBeGreaterThan(0)
  })

  it('q-backfills only missing recipients when campaign list is partial', async () => {
    const listCalls: Array<{ q?: string; campaign?: string }> = []
    const list = vi.fn(async (params: { q?: string; campaign?: string }) => {
      listCalls.push({ q: params.q, campaign: params.campaign })
      if (params.q === 'msg-3') {
        return {
          total: 1,
          items: [archiveItem({ id: 'arc-3', messageId: 'msg-3', sesMessageId: 'msg-3' })]
        }
      }
      if (params.campaign || params.q) {
        return {
          total: 2,
          items: [
            archiveItem({ id: 'arc-1', messageId: 'msg-1', sesMessageId: 'msg-1' }),
            archiveItem({ id: 'arc-2', messageId: 'msg-2', sesMessageId: 'msg-2' })
          ]
        }
      }
      return { total: 0, items: [] }
    })
    const getById = vi.fn(async (item: { archiveId: string }) => ({
      ...archiveItem({ id: item.archiveId }),
      events: []
    }))

    const result = await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-01',
      toYmd: '2026-09-01',
      config: { ...zcMailConfig },
      archiveClient: { list, getById }
    })

    expect(result.debug?.usedMessageIdBackfill).toBe(true)
    expect(listCalls.filter((c) => c.q === 'msg-1' || c.q === 'msg-2')).toHaveLength(0)
    expect(listCalls.some((c) => c.q === 'msg-3')).toBe(true)
    expect(result.fetched).toBeGreaterThan(0)
  })

  it('backfills by recipient message id when campaign filter returns other campaigns', async () => {
    const listCalls: Array<{ q?: string; campaign?: string; skip?: number }> = []
    const list = vi.fn(
      async (params: { q?: string; campaign?: string; skip?: number }) => {
        listCalls.push({
          q: params.q,
          campaign: params.campaign,
          skip: params.skip
        })
        if (params.campaign) {
          // Wrong campaign rows (empty tags) — matches production zcMail bug.
          return {
            total: 1,
            items: [
              {
                id: 'arc-wrong',
                messageId: 'other-uuid',
                sesMessageId: '010101-other-campaign',
                to: ['x@example.com'],
                from: 'from@example.com',
                subject: 'Other campaign',
                tenantName: 't',
                recipient: 'x@example.com',
                status: 'sent',
                createdAt: '2026-09-08T15:00:00.000Z',
                tags: {}
              }
            ]
          }
        }
        if (params.q === 'msg-1') {
          return {
            total: 1,
            items: [
              {
                id: 'arc-target',
                messageId: 'uuid-1',
                sesMessageId: 'msg-1',
                to: ['a@example.com'],
                from: 'from@example.com',
                subject: 'Target campaign',
                tenantName: 't',
                recipient: 'a@example.com',
                status: 'sent',
                createdAt: '2026-09-03T12:00:00.000Z',
                tags: {}
              }
            ]
          }
        }
        return { total: 0, items: [] }
      }
    )
    const getById = vi.fn(async (item: { archiveId: string }) => ({
      id: item.archiveId,
      messageId: 'uuid-1',
      sesMessageId: 'msg-1',
      to: ['a@example.com'],
      from: 'from@example.com',
      subject: 'Target campaign',
      tenantName: 't',
      recipient: 'a@example.com',
      status: 'sent',
      createdAt: '2026-09-03T12:00:00.000Z',
      events: []
    }))

    const result = await syncTenantZcMailTrackingEvents({
      dbName: 'tenant_db',
      campaignId: 'camp-1',
      fromYmd: '2026-09-03',
      toYmd: '2026-09-09',
      config: { ...zcMailConfig },
      archiveClient: { list, getById }
    })

    expect(listCalls.some((c) => c.q === 'msg-1')).toBe(true)
    expect(result.debug?.usedMessageIdBackfill).toBe(true)
    expect(result.debug?.matched).toBeGreaterThan(0)
    expect(result.fetched).toBeGreaterThan(0)
  })
})
