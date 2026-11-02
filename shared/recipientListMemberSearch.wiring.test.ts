import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('recipient list detail member search wiring (LO flag)', () => {
  it('detail API supports optional q without changing default empty-q path structure', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/recipient-list/[id].get.ts'),
      'utf8'
    )
    expect(api).toContain('normalizeRecipientListMemberSearchQ')
    expect(api).toContain('memberSearchActive')
    expect(api).toContain('recipientListMemberSearchOrClauses')
    // Classic member pagination path retained when search inactive.
    expect(api).toContain('RecipientListMember.find(memberQuery)')
  })

  it('detail page shows search + anti-flicker only when LO recipient-list flag is on', () => {
    const page = readFileSync(
      resolve(root, 'app/pages/tenant/recipient-list/[id].vue'),
      'utf8'
    )
    expect(page).toContain('showLoMemberSearch')
    expect(page).toContain('allowTenantLoRecipientLists')
    expect(page).toContain('Search by name or email')
    expect(page).toContain('rl-detail-member-search')
    expect(page).toMatch(/q\.length >= 2 \? \{ q \}/)
    // Anti-flicker overlay is flag-gated; classic path keeps header Loading…
    expect(page).toContain('showLoMemberSearch && pageLoading')
    expect(page).toContain('Updating results…')
    expect(page).toMatch(/v-else[\s\S]*Loading…/)
  })
})

