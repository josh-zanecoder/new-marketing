import { describe, expect, it } from 'vitest'
import { registryDocToCriteria } from '../server/utils/recipient/recipientListNormalization'
import { BUILTIN_FILTERS, builtinFilterDoc, isBuiltinFilterId } from './campaignBuiltinFilters'

describe('built-in contact field filters', () => {
  it('recognises only builtin: ids', () => {
    expect(isBuiltinFilterId('builtin:state')).toBe(true)
    expect(isBuiltinFilterId('65f0c0ffee0000000000aaaa')).toBe(false)
    expect(builtinFilterDoc('builtin:nope', 'borrower')).toBeNull()
    expect(builtinFilterDoc('65f0c0ffee0000000000aaaa', 'borrower')).toBeNull()
  })

  it('covers address, company and the other standard contact fields', () => {
    expect(BUILTIN_FILTERS.map((f) => f.name)).toEqual([
      'State',
      'City',
      'ZIP code',
      'County',
      'Street address',
      'Company',
      'Channel',
      'Stage',
      'Source',
      'Priority',
      'Broker role'
    ])
  })

  const expected: Record<string, [string, string]> = {
    state: ['state', 'TX'],
    city: ['city', 'Austin'],
    zip: ['zip', '78701'],
    county: ['county', 'Travis'],
    street: ['street', 'Main'],
    company: ['company', 'Acme'],
    channel: ['channel', 'Retail'],
    stage: ['stage', 'Prospect'],
    source: ['source', 'webinar'],
    priority: ['priority', 'High'],
    broker_role: ['broker_role', 'Loan officer']
  }
  for (const def of BUILTIN_FILTERS) {
    it(`${def.key} becomes a ${expected[def.key]![0]} criterion`, () => {
      const doc = builtinFilterDoc(`builtin:${def.key}`, 'borrower')!
      expect(doc.contactType).toBe('borrower')
      const criteria = registryDocToCriteria({ ...doc, propertyValue: expected[def.key]![1] })
      expect(criteria).toEqual([{ property: expected[def.key]![0], value: expected[def.key]![1] }])
    })
  }
})
