import { describe, expect, it } from 'vitest'
import { loadArchivesInRange, type ZcMailArchiveTrackingClient } from '../../tracking/syncTenantZcMailTrackingEvents'
import type { ZcMailArchiveListItem } from '../types/zcMailArchive'

function archiveRow(index: number, prefix: string): ZcMailArchiveListItem {
  return {
    id: `${prefix}-archive-${index}`,
    messageId: `<${prefix}-msg-${index}@zcmail>`,
    sesMessageId: `${prefix}-ses-${index}`,
    to: [`r${index}@example.com`],
    from: 'ae@example.com',
    subject: 'Clients',
    tenantName: 'tenant',
    recipient: `r${index}@example.com`,
    status: 'delivered',
    createdAt: '2026-10-10T16:10:00.000Z'
  }
}

function fakeClient(rows: ZcMailArchiveListItem[]): ZcMailArchiveTrackingClient {
  return {
    list: (async (params: { limit?: number; skip?: number }) => {
      const skip = params.skip ?? 0
      const items = rows.slice(skip, skip + (params.limit ?? 200))
      return { total: rows.length, items }
    }) as ZcMailArchiveTrackingClient['list'],
    getById: (async () => {
      throw new Error('not used')
    }) as ZcMailArchiveTrackingClient['getById']
  }
}

describe('loadArchivesInRange', () => {
  it('pages through the whole campaign when each archive row carries several ids', async () => {
    const campaignRows = Array.from({ length: 1924 }, (_, i) => archiveRow(i, 'campaign'))
    const otherRows = Array.from({ length: 600 }, (_, i) => archiveRow(i, 'other'))
    const matchMessageIds = new Set(campaignRows.map((row) => row.sesMessageId))

    const items = await loadArchivesInRange({
      client: fakeClient([...campaignRows, ...otherRows]),
      baseUrl: 'https://zcmail.test',
      apiKey: 'key',
      tenantName: 'tenant',
      fromYmd: '2026-10-10',
      toYmd: '2026-10-11',
      matchMessageIds,
      abortIfNoMessageIdMatch: true,
      keepMatchedOnly: true
    })

    expect(items).toHaveLength(1924)
  })

  it('stops paging once every campaign message id is found', async () => {
    const campaignRows = Array.from({ length: 300 }, (_, i) => archiveRow(i, 'campaign'))
    const otherRows = Array.from({ length: 2000 }, (_, i) => archiveRow(i, 'other'))
    const requestedSkips: number[] = []
    const client = fakeClient([...campaignRows, ...otherRows])
    const list = client.list
    client.list = (async (params: Parameters<typeof list>[0]) => {
      requestedSkips.push(params.skip ?? 0)
      return list(params)
    }) as ZcMailArchiveTrackingClient['list']

    const items = await loadArchivesInRange({
      client,
      baseUrl: 'https://zcmail.test',
      apiKey: 'key',
      tenantName: 'tenant',
      matchMessageIds: new Set(campaignRows.map((row) => row.sesMessageId)),
      keepMatchedOnly: true
    })

    expect(items).toHaveLength(300)
    expect(Math.max(...requestedSkips)).toBeLessThan(800)
  })
})
