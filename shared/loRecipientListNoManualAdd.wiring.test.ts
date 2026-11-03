import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('LO recipient-list Manual Add removed (classic unchanged)', () => {
  it('LO simple form has no Manual Add API/UI state', () => {
    const form = readFileSync(
      resolve(root, 'app/composables/useLoRecipientListSimpleForm.ts'),
      'utf8'
    )
    expect(form).not.toContain('manualEmail')
    expect(form).not.toContain('addBorrowerByEmail')
    expect(form).not.toContain('borrowersTab')
    expect(form).not.toContain('Manual Add')
    expect(form).toContain('allowTenantLoRecipientLists')
    expect(form).toContain('lo-borrowers')
  })

  it('add/edit LO UI has no Manual Add; classic form still wired when flag off', () => {
    for (const rel of [
      'app/pages/tenant/recipient-list/add.vue',
      'app/pages/tenant/recipient-list/edit/[id].vue'
    ] as const) {
      const page = readFileSync(resolve(root, rel), 'utf8')
      expect(page).not.toContain('Manual Add')
      expect(page).not.toContain('loManualEmail')
      expect(page).not.toContain('loAddBorrowerByEmail')
      expect(page).toContain('isLoMode')
      expect(page).toContain('useLoRecipientListSimpleForm')
      expect(page).toContain('useRecipientListForm')
    }
  })

  it('classic useRecipientListForm is untouched', () => {
    const classic = readFileSync(
      resolve(root, 'app/composables/useRecipientListForm.ts'),
      'utf8'
    )
    expect(classic).not.toContain('useLoRecipientListSimpleForm')
    expect(classic).not.toContain('lo-borrowers')
    expect(classic).not.toContain('manualEmail')
  })
})
