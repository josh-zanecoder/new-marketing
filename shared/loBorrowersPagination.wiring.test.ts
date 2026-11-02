import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('LO recipient-list borrower pagination wiring (flag path only)', () => {
  it('API accepts skip and uses shared page limits', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/recipient-list/lo-borrowers.get.ts'),
      'utf8'
    )
    expect(api).toContain('allowTenantLoRecipientLists')
    expect(api).toContain('LO_BORROWERS_PREVIEW_MAX_LIMIT')
    expect(api).toContain('LO_BORROWERS_PREVIEW_PAGE_SIZE')
    expect(api).toContain('q.skip')
    expect(api).toContain('.skip(')
  })

  it('simple LO form loads all pages via loadAllLoBorrowerPages (not a hard 50)', () => {
    const form = readFileSync(
      resolve(root, 'app/composables/useLoRecipientListSimpleForm.ts'),
      'utf8'
    )
    expect(form).toContain('loadAllLoBorrowerPages')
    expect(form).toContain("'/api/v1/tenant/recipient-list/lo-borrowers'")
    expect(form).not.toMatch(/limit:\s*50\b/)
    // Classic form must stay untouched by this fix.
    const classic = readFileSync(resolve(root, 'app/composables/useRecipientListForm.ts'), 'utf8')
    expect(classic).not.toContain('loadAllLoBorrowerPages')
    expect(classic).not.toContain('lo-borrowers')
  })
})
