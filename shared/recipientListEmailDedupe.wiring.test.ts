import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('LO recipient-list email dedupe wiring (flag path only)', () => {
  it('shared helper keeps first row per normalized email', () => {
    const helper = readFileSync(resolve(root, 'shared/dedupeByNormalizedEmail.ts'), 'utf8')
    expect(helper).toContain('dedupeByNormalizedEmailKeepFirst')
    expect(helper).toContain('normalizeRecipientEmailKey')
  })

  it('membership rebuild accepts dedupeByEmail for LO-scoped writes', () => {
    const query = readFileSync(
      resolve(root, 'server/utils/recipient/recipientListMembershipQuery.ts'),
      'utf8'
    )
    expect(query).toContain('dedupeByEmail')
    expect(query).toContain('seenEmails')

    const service = readFileSync(
      resolve(root, 'server/utils/recipient/recipientListService.ts'),
      'utf8'
    )
    expect(service).toContain('dedupeMemberEmails')
    expect(service).toContain('dedupeByEmail: w.dedupeMemberEmails')
    expect(service).toContain('allowTenantLoRecipientLists')
  })

  it('contact sync rebuilds LO lists with email dedupe', () => {
    const sync = readFileSync(
      resolve(root, 'server/utils/recipient/syncContactRecipientListMembership.ts'),
      'utf8'
    )
    expect(sync).toContain('associatedLoanOfficerEmail')
    expect(sync).toContain('dedupeByEmail')
  })

  it('list detail GET dedupes only LO-scoped lists under the LO flag (classic unchanged)', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/recipient-list/[id].get.ts'),
      'utf8'
    )
    expect(api).toContain('allowTenantLoRecipientLists')
    expect(api).toContain('associatedLoanOfficerEmail')
    expect(api).toContain('dedupeByNormalizedEmailKeepFirst')
    expect(api).toContain('dedupeMemberEmails')
    // Must require both flag + LO email — not flag alone (that would change classic lists).
    expect(api).toMatch(
      /allowTenantLoRecipientLists === true &&\s*Boolean\(associatedLoEmail\)/
    )
  })

  it('create/update only enables membership email dedupe inside allowLoLists + LO email', () => {
    const service = readFileSync(
      resolve(root, 'server/utils/recipient/recipientListService.ts'),
      'utf8'
    )
    expect(service).toContain('if (allowLoLists)')
    expect(service).toContain('dedupeMemberEmails = true')
    // Default stays false for classic writes.
    expect(service).toContain('let dedupeMemberEmails = false')
  })

  it('lo-borrowers preview also collapses duplicate emails under the flag', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/recipient-list/lo-borrowers.get.ts'),
      'utf8'
    )
    expect(api).toContain('dedupeByNormalizedEmailKeepFirst')
    expect(api).toContain('allowTenantLoRecipientLists')
  })
})
