import { describe, expect, it } from 'vitest'
import { buildRecipientListAudienceOptions } from '../recipientListAudienceOptions'

describe('buildRecipientListAudienceOptions', () => {
  it('sorts by contact type order and appends counts when present', () => {
    const options = buildRecipientListAudienceOptions({
      recipientFilters: [{ enabled: true, contactType: 'client' }],
      contactTypes: [
        { key: 'prospect', label: 'Prospect', sortOrder: 0 },
        { key: 'client', label: 'Client', sortOrder: 1 }
      ],
      contactCounts: { prospect: 12, client: 3 }
    })

    expect(options).toEqual([
      { value: 'prospect', label: 'Prospect (12)' },
      { value: 'client', label: 'Client (3)' }
    ])
  })

  it('omits disabled contact types and filters', () => {
    const options = buildRecipientListAudienceOptions({
      recipientFilters: [{ enabled: false, contactType: 'hidden' }],
      contactTypes: [{ key: 'prospect', label: 'Prospect', sortOrder: 0, enabled: false }]
    })

    expect(options).toEqual([])
  })
})
