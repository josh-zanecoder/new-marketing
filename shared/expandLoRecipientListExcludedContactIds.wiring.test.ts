import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('LO recipient-list exclusion expansion (email-dedupe)', () => {
  it('expands unchecked checklist exclusions across duplicate Contact emails on write', () => {
    const service = readFileSync(
      resolve(root, 'server/utils/recipient/recipientListService.ts'),
      'utf8'
    )
    const helper = readFileSync(
      resolve(root, 'server/utils/recipient/expandLoRecipientListExcludedContactIds.ts'),
      'utf8'
    )
    expect(service).toContain('expandLoRecipientListExcludedContactIds')
    expect(service).toContain('excludedContactEmails')
    expect(helper).toContain('audienceBaseQuery')
    expect(helper).toContain('mergeContactOwnerScopeFilter')
  })

  it('rebuild skips excluded emails when LO dedupeByEmail is on', () => {
    const query = readFileSync(
      resolve(root, 'server/utils/recipient/recipientListMembershipQuery.ts'),
      'utf8'
    )
    expect(query).toContain('excludedEmails')
    expect(query).toContain('if (excludedEmails.has(email)) continue')
  })

  it('LO create form sends excludedContactEmails with unchecked borrowers', () => {
    const form = readFileSync(
      resolve(root, 'app/composables/useLoRecipientListSimpleForm.ts'),
      'utf8'
    )
    expect(form).toContain('excludedContactEmails')
    expect(form).toContain('checkedBorrowerCount')
  })
})
