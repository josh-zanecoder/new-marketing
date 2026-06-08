import { describe, expect, it } from 'vitest'
import { mapRecipientListPickerToCatalog } from '../campaignContactPickerCatalog'

describe('mapRecipientListPickerToCatalog', () => {
  it('maps contacts and filters rows without email', () => {
    const result = mapRecipientListPickerToCatalog({
      contacts: [
        { id: '1', name: 'Ada', email: 'ada@example.com', contactType: ['prospect'] },
        { id: '2', name: 'No Email', email: '', contactType: ['client'] }
      ],
      contactCounts: { prospect: 3, client: 1 },
      contactTypes: [{ key: 'prospect', label: 'Prospect', sortOrder: 0 }],
      contactsTruncated: true
    })

    expect(result.rows).toEqual([
      {
        id: '1',
        name: 'Ada',
        email: 'ada@example.com',
        company: undefined,
        contactType: ['prospect']
      }
    ])
    expect(result.typeCounts).toEqual({ prospect: 3, client: 1 })
    expect(result.typeOptions).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  it('falls back to first enabled contact type when row has no types', () => {
    const result = mapRecipientListPickerToCatalog({
      contacts: [{ id: '1', name: 'Bob', email: 'bob@example.com' }],
      contactTypes: [
        { key: 'prospect', label: 'Prospect', sortOrder: 0, enabled: false },
        { key: 'client', label: 'Client', sortOrder: 1, enabled: true }
      ]
    })

    expect(result.rows[0]?.contactType).toEqual(['client'])
  })
})
