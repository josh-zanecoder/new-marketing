import type { Connection } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { resolveRecipientListFiltersFromBody } from '../recipientListMutation'

// Nuxt auto-imports `createError` in the server; Vitest has no auto-imports.
vi.stubGlobal('createError', (o: { statusCode: number, message: string }) =>
  Object.assign(new Error(o.message), o)
)

const conn = {} as Connection
const body = {
  filterGroups: [
    {
      rows: [
        { recipientFilterId: 'builtin:state', listPropertyValue: 'TX' },
        { recipientFilterId: 'builtin:city', listPropertyValue: 'Austin' }
      ],
      joins: ['and']
    }
  ],
  groupJoins: []
}

describe('built-in filters in the filter body', () => {
  it('resolve to criteria without any registry record when Advanced filtering allows them', async () => {
    const out = await resolveRecipientListFiltersFromBody(body, conn, 'borrower', true)
    expect(out.filters).toEqual([
      { property: 'state', value: 'TX' },
      { property: 'city', value: 'Austin' }
    ])
    expect(out.persistedFilterRows).toEqual([
      { recipientFilterId: 'builtin:state', listPropertyValue: 'TX' },
      { recipientFilterId: 'builtin:city', listPropertyValue: 'Austin' }
    ])
  })

  it('are rejected everywhere else (the regular recipient list API)', async () => {
    await expect(resolveRecipientListFiltersFromBody(body, conn, 'borrower')).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('still require a value', async () => {
    await expect(
      resolveRecipientListFiltersFromBody(
        { filterGroups: [{ rows: [{ recipientFilterId: 'builtin:zip', listPropertyValue: '' }], joins: [] }] },
        conn,
        'borrower',
        true
      )
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
