import { describe, expect, it, vi } from 'vitest'
import {
  normalizeZcMailArchiveListItem,
  unwrapZcMailArchiveDetailBody,
  listZcMailArchive
} from './zcMailArchiveClient'

describe('zcMailArchiveClient', () => {
  it('normalizes list items including object tags', () => {
    const item = normalizeZcMailArchiveListItem({
      id: 'arc-1',
      sesMessageId: 'ses-1',
      recipient: 'a@example.com',
      status: 'sent',
      createdAt: '2026-08-31T00:00:00.000Z',
      tags: { db: 'acme_db', campaign: 'abc' }
    })
    expect(item).toMatchObject({
      id: 'arc-1',
      sesMessageId: 'ses-1',
      tags: { db: 'acme_db', campaign: 'abc' }
    })
  })

  it('unwraps { item } detail envelopes', () => {
    const detail = unwrapZcMailArchiveDetailBody({
      item: {
        id: 'arc-1',
        sesMessageId: 'ses-1',
        recipient: 'a@example.com',
        status: 'sent',
        createdAt: '2026-08-31T00:00:00.000Z',
        events: [{ eventType: 'Open', eventTimestamp: '2026-08-31T00:01:00.000Z' }]
      }
    })
    expect(detail.id).toBe('arc-1')
    expect(detail.events).toHaveLength(1)
    expect(detail.events?.[0]?.eventType).toBe('Open')
  })

  it('lists archive with tenant query and API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          total: 1,
          items: [
            {
              id: 'arc-1',
              recipient: 'a@example.com',
              status: 'sent',
              createdAt: '2026-08-31T00:00:00.000Z'
            }
          ]
        })
    })
    const result = await listZcMailArchive(
      {
        baseUrl: 'https://apizcmail.zanecoder.com/',
        apiKey: 'zcm_test',
        tenantName: 'crm-test2',
        q: '6a6cc9c694cfdfdb1fb29cab',
        campaign: '6a6cc9c694cfdfdb1fb29cab'
      },
      fetchImpl as unknown as typeof fetch
    )
    expect(result.items).toHaveLength(1)
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('/v1/mail/archive?')
    expect(url).toContain('tenant=crm-test2')
    expect(url).toContain('q=6a6cc9c694cfdfdb1fb29cab')
    expect(url).toContain('campaign=6a6cc9c694cfdfdb1fb29cab')
    expect(url).toContain('tag=campaign%3A6a6cc9c694cfdfdb1fb29cab')
  })

  it('parses campaign tags from string arrays', () => {
    const item = normalizeZcMailArchiveListItem({
      id: 'arc-1',
      recipient: 'a@example.com',
      status: 'sent',
      createdAt: '2026-08-31T00:00:00.000Z',
      tags: ['db:acme_db', 'campaign:abc']
    })
    expect(item?.tags).toEqual({ db: 'acme_db', campaign: 'abc' })
  })
})
