import { describe, expect, it } from 'vitest'
import {
  canWriteEmailTemplate,
  emailTemplateOwnershipFromAuth,
  mergeEmailTemplateVisibilityFilter
} from '@server/utils/emailTemplate/emailTemplateOwnership'

const aeAuth = {
  type: 'tenantApiKey',
  role: 'tenant',
  dbName: 'forge_capital_lending_db',
  tenantName: 'Forge',
  tenantUserEmail: 'LThompson@myfcltpo.com',
  contactOwnerScope: ['lthompson@myfcltpo.com']
}

const tenantWideAuth = {
  ...aeAuth,
  tenantUserEmail: 'admin@myfcltpo.com',
  tenantWideContacts: true,
  contactOwnerScope: []
}

const emptyScopeAuth = { ...aeAuth, contactOwnerScope: [] }

const sharedOr = [
  { 'metadata.ownerEmail': { $exists: false } },
  { 'metadata.ownerEmail': null },
  { 'metadata.ownerEmail': '' }
]

describe('emailTemplateOwnershipFromAuth', () => {
  it('stamps the AE as owner for owner-scoped sessions', () => {
    expect(emailTemplateOwnershipFromAuth(aeAuth).metadata).toEqual({
      ownerEmail: 'lthompson@myfcltpo.com'
    })
  })

  it('creates shared templates for tenant-wide sessions', () => {
    expect(emailTemplateOwnershipFromAuth(tenantWideAuth).metadata).toBeUndefined()
  })

  it('creates shared templates for non API-key sessions', () => {
    expect(emailTemplateOwnershipFromAuth({ role: 'tenant', dbName: 'x' })).toEqual({})
  })
})

describe('mergeEmailTemplateVisibilityFilter', () => {
  const base = { saveToLibrary: { $ne: false } }

  it('is unfiltered for tenant-wide sessions', () => {
    expect(mergeEmailTemplateVisibilityFilter(base, tenantWideAuth)).toBe(base)
  })

  it('is unfiltered for non API-key sessions', () => {
    expect(mergeEmailTemplateVisibilityFilter(base, { role: 'tenant', dbName: 'x' })).toBe(base)
  })

  it('limits owner-scoped sessions to shared templates and their own', () => {
    expect(mergeEmailTemplateVisibilityFilter(base, aeAuth)).toEqual({
      $and: [
        base,
        { $or: [...sharedOr, { 'metadata.ownerEmail': { $in: ['lthompson@myfcltpo.com'] } }] }
      ]
    })
  })

  it('limits empty-scope sessions to shared templates only', () => {
    expect(mergeEmailTemplateVisibilityFilter(base, emptyScopeAuth)).toEqual({
      $and: [base, { $or: sharedOr }]
    })
  })
})

describe('canWriteEmailTemplate', () => {
  const own = { metadata: { ownerEmail: 'lthompson@myfcltpo.com' } }
  const other = { metadata: { ownerEmail: 'jsmith@myfcltpo.com' } }
  const shared = { metadata: {} }

  it('lets owner-scoped sessions write only their own templates', () => {
    expect(canWriteEmailTemplate(own, aeAuth)).toBe(true)
    expect(canWriteEmailTemplate(other, aeAuth)).toBe(false)
    expect(canWriteEmailTemplate(shared, aeAuth)).toBe(false)
    expect(canWriteEmailTemplate({}, aeAuth)).toBe(false)
  })

  it('lets tenant-wide sessions write any template', () => {
    expect(canWriteEmailTemplate(other, tenantWideAuth)).toBe(true)
    expect(canWriteEmailTemplate(shared, tenantWideAuth)).toBe(true)
  })

  it('rejects missing templates', () => {
    expect(canWriteEmailTemplate(null, tenantWideAuth)).toBe(false)
  })
})
