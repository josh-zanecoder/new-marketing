import { describe, expect, it } from 'vitest'
import {
  canonicalZcMailArchiveMessageId,
  mapZcMailArchiveEventName,
  mapZcMailArchiveItemToTrackingEvents,
  zcMailArchiveBelongsToScope,
  zcMailArchiveInDateRange
} from './mapZcMailArchiveToTrackingEvents'
import type { ZcMailArchiveDetail, ZcMailArchiveListItem } from '@server/utils/zcmail/types/zcMailArchive'

const campaignId = '6a6cc9c694cfdfdb1fb29cab'

function baseItem(overrides: Partial<ZcMailArchiveListItem> = {}): ZcMailArchiveListItem {
  return {
    id: 'arc-1',
    messageId: 'msg-1',
    sesMessageId: 'ses-1',
    to: ['a@example.com'],
    from: 'noreply@acme.example',
    subject: 'Hello',
    tenantName: 'acme',
    recipient: 'a@example.com',
    status: 'sent',
    createdAt: '2026-08-31T04:16:00.000Z',
    tags: {
      source: 'new-marketing-campaign',
      db: 'acme_db',
      campaign: campaignId
    },
    ...overrides
  }
}

describe('mapZcMailArchiveToTrackingEvents', () => {
  it('maps sent archive rows to requests + delivered using SES message id', () => {
    const events = mapZcMailArchiveItemToTrackingEvents(baseItem())
    expect(canonicalZcMailArchiveMessageId(baseItem())).toBe('ses-1')
    expect(events.map((e) => e.event)).toEqual(['requests', 'delivered'])
    expect(events[0]?.messageId).toBe('ses-1')
    expect(events[0]?.tag).toContain(`campaign:${campaignId}`)
  })

  it('maps failed archive rows to requests + hardBounces', () => {
    const events = mapZcMailArchiveItemToTrackingEvents(
      baseItem({ status: 'failed', error: 'Tenant not associated with resources' })
    )
    expect(events.map((e) => e.event)).toEqual(['requests', 'hardBounces'])
    expect(events[1]?.reason).toContain('Tenant not associated')
  })

  it('maps SES detail events onto tracking vocabulary', () => {
    const detail: ZcMailArchiveDetail = {
      ...baseItem(),
      events: [
        { eventType: 'Send', eventTimestamp: '2026-08-31T04:16:01.000Z' },
        { eventType: 'Delivery', eventTimestamp: '2026-08-31T04:16:02.000Z' },
        { eventType: 'Open', eventTimestamp: '2026-08-31T04:20:00.000Z' },
        { eventType: 'Click', eventTimestamp: '2026-08-31T04:21:00.000Z' }
      ]
    }
    const events = mapZcMailArchiveItemToTrackingEvents(detail)
    expect(events.map((e) => e.event)).toEqual(['requests', 'delivered', 'opened', 'clicks'])
  })

  it('filters to the marketing campaign and skips ratesheet archive rows', () => {
    expect(
      zcMailArchiveBelongsToScope(baseItem(), { dbName: 'acme_db', campaignId })
    ).toBe(true)
    expect(
      zcMailArchiveBelongsToScope(baseItem(), {
        dbName: 'acme_db',
        campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa'
      })
    ).toBe(false)
    expect(
      zcMailArchiveBelongsToScope(
        baseItem({ tags: { source: 'mortdash-crm-ratesheet' } }),
        { dbName: 'acme_db' }
      )
    ).toBe(false)
  })

  it('keeps untagged archive rows for tenant-wide tracking, not other campaigns', () => {
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined }), {
        dbName: 'acme_db',
        campaignId,
        campaignMessageIds: new Set(['ses-1'])
      })
    ).toBe(true)
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined }), {
        dbName: 'acme_db',
        campaignId
      })
    ).toBe(false)
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined }), { dbName: 'acme_db' })
    ).toBe(true)
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: { db: 'other_db' } }), {
        dbName: 'acme_db'
      })
    ).toBe(false)
  })

  it('does not treat "same recipient email" as this campaign', () => {
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined, from: 'hans@zanecoder.com' }), {
        dbName: 'acme_db',
        campaignId
      })
    ).toBe(false)
  })

  it('excludes campaign test emails from campaign statistics scope', () => {
    expect(
      zcMailArchiveBelongsToScope(
        baseItem({
          tags: {
            source: 'new-marketing-test',
            db: 'acme_db',
            campaign: campaignId
          }
        }),
        { dbName: 'acme_db', campaignId }
      )
    ).toBe(false)
  })

  it('matches campaign by stored recipient message id', () => {
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined, sesMessageId: 'ses-9' }), {
        dbName: 'acme_db',
        campaignId,
        campaignMessageIds: new Set(['ses-9'])
      })
    ).toBe(true)
  })

  it('uses routing when archive tags are missing', () => {
    expect(
      zcMailArchiveBelongsToScope(baseItem({ tags: undefined }), {
        dbName: 'acme_db',
        campaignId,
        routedCampaignId: campaignId,
        routedDbName: 'acme_db'
      })
    ).toBe(true)
  })

  it('filters date range by UTC day', () => {
    expect(zcMailArchiveInDateRange('2026-08-31T04:16:00.000Z', '2026-08-31', '2026-08-31')).toBe(
      true
    )
    expect(zcMailArchiveInDateRange('2026-08-30T04:16:00.000Z', '2026-08-31', '2026-08-31')).toBe(
      false
    )
  })

  it('maps SES Bounce to hardBounces', () => {
    expect(mapZcMailArchiveEventName('Bounce')).toBe('hardBounces')
    expect(mapZcMailArchiveEventName('Delivery')).toBe('delivered')
  })
})
