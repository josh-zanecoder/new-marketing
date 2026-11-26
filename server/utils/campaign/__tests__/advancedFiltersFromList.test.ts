import { describe, expect, it } from 'vitest'
import { advancedRecipientFiltersFromListDoc } from '../advancedFiltersFromList'

const tenantWide = {
  type: 'tenantApiKey',
  role: 'tenant',
  tenantName: 't',
  dbName: 'db',
  tenantWideContacts: true
}

const scoped = {
  type: 'tenantApiKey',
  role: 'tenant',
  tenantName: 't',
  dbName: 'db',
  contactOwnerScope: ['rajeev@acme.com', 'sam@acme.com']
}

const baseDoc = {
  audience: 'Borrower ',
  filterMode: 'and',
  criterionJoins: ['and'],
  filterRows: [{ recipientFilterId: 'f1', listPropertyValue: 'TX', _id: 'x' }],
  filterGroups: [
    { rows: [{ recipientFilterId: 'f1', listPropertyValue: ' TX ' }], joins: [], _id: 'g' },
    { rows: [], joins: [] }
  ],
  groupJoins: ['or'],
  membershipScope: 'tenant',
  membershipOwnerEmails: [] as string[],
  audienceStatuses: ['past_borrower']
}

describe('advancedRecipientFiltersFromListDoc', () => {
  it('rebuilds the saved filter rows, groups and statuses', () => {
    const out = advancedRecipientFiltersFromListDoc(baseDoc, tenantWide)
    expect(out.audience).toBe('borrower')
    expect(out.filterGroups).toEqual([
      { rows: [{ recipientFilterId: 'f1', listPropertyValue: 'TX' }], joins: [] }
    ])
    expect(out.filterRows).toEqual([{ recipientFilterId: 'f1', listPropertyValue: 'TX' }])
    expect(out.groupJoins).toEqual(['or'])
    expect(out.audienceStatuses).toEqual(['past_borrower'])
    expect(out.loanOfficerEmails).toEqual([])
  })

  it('returns picked loan officers for a tenant-wide sender', () => {
    const out = advancedRecipientFiltersFromListDoc(
      {
        ...baseDoc,
        membershipScope: 'owner_emails',
        membershipOwnerEmails: ['Rajeev@acme.com', 'sam@acme.com']
      },
      tenantWide
    )
    expect(out.loanOfficerEmails).toEqual(['rajeev@acme.com', 'sam@acme.com'])
  })

  it('treats a scoped sender default scope as "no explicit pick"', () => {
    const out = advancedRecipientFiltersFromListDoc(
      {
        ...baseDoc,
        membershipScope: 'owner_emails',
        membershipOwnerEmails: ['sam@acme.com', 'rajeev@acme.com']
      },
      scoped
    )
    expect(out.loanOfficerEmails).toEqual([])
  })

  it('returns a narrower pick for a scoped sender', () => {
    const out = advancedRecipientFiltersFromListDoc(
      { ...baseDoc, membershipScope: 'owner_emails', membershipOwnerEmails: ['sam@acme.com'] },
      scoped
    )
    expect(out.loanOfficerEmails).toEqual(['sam@acme.com'])
  })

  it('copes with a list that has no groups or statuses', () => {
    const out = advancedRecipientFiltersFromListDoc({ audience: 'borrower' }, tenantWide)
    expect(out.filterGroups).toEqual([])
    expect(out.audienceStatuses).toEqual([])
    expect(out.filterMode).toBe('and')
  })
})
