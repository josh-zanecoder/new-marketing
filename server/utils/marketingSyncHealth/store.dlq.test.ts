import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertOne = vi.fn().mockResolvedValue({ insertedId: '1' })
const findToArray = vi.fn().mockResolvedValue([])
const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 })

vi.mock('@server/lib/mongoose', () => ({
  getRegistryConnection: vi.fn(async () => ({
    collection: () => ({
      insertOne,
      find: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              toArray: findToArray
            })
          }),
          limit: () => ({
            toArray: findToArray
          })
        })
      }),
      deleteMany
    })
  }))
}))

describe('recordMarketingSyncDlq', () => {
  beforeEach(() => {
    insertOne.mockClear()
    findToArray.mockResolvedValue([])
    deleteMany.mockClear()
  })

  it('inserts a DLQ row and a history log for swallowed failures', async () => {
    const { recordMarketingSyncDlq } = await import('./store')
    await recordMarketingSyncDlq({
      error: 'Types is not defined',
      eventType: 'contact.updated',
      tenantId: 'tenant-a',
      dbName: 'tenant_a_db',
      kafkaTopic: 'marketing.events.tenant_a',
      partition: 0,
      offset: '42',
      raw: '{"eventType":"contact.updated"}'
    })

    expect(insertOne).toHaveBeenCalled()
    const firstDoc = insertOne.mock.calls[0]?.[0] as Record<string, unknown>
    expect(firstDoc.error).toBe('Types is not defined')
    expect(firstDoc.eventType).toBe('contact.updated')
    expect(firstDoc.offset).toBe('42')
    expect(firstDoc.dbName).toBe('tenant_a_db')

    // Second insert is the history log (kind: dlq)
    expect(insertOne.mock.calls.length).toBeGreaterThanOrEqual(2)
    const logDoc = insertOne.mock.calls.find(
      (call) => (call[0] as { kind?: string }).kind === 'dlq'
    )?.[0] as { kind?: string; message?: string }
    expect(logDoc?.kind).toBe('dlq')
    expect(logDoc?.message).toContain('DLQ:')
  })

  it('no-ops without an error message', async () => {
    const { recordMarketingSyncDlq } = await import('./store')
    insertOne.mockClear()
    await recordMarketingSyncDlq({ error: '   ' })
    expect(insertOne).not.toHaveBeenCalled()
  })
})
