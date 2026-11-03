import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('recipient list bulk remove (LO flag path)', () => {
  it('exposes a flag-gated bulk-remove API', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/recipient-list/[id]/members/bulk-remove.post.ts'),
      'utf8'
    )
    expect(api).toContain('allowTenantLoRecipientLists')
    expect(api).toContain('$addToSet')
    expect(api).toContain('excludedContactIds')
    expect(api).toContain('deleteMany')
  })

  it('detail UI wires checkboxes + bulk remove only behind showLoMemberSearch', () => {
    const page = readFileSync(
      resolve(root, 'app/pages/tenant/recipient-list/[id].vue'),
      'utf8'
    )
    expect(page).toContain('showLoMemberSearch')
    expect(page).toContain('Remove Selected')
    expect(page).toContain('toggleSelectAllPage')
    expect(page).toContain('bulkRemoveRecipientListMembers')
    expect(page).toContain('Select all on this page')
    expect(page).toContain('rl-member-select-all')
    expect(page).toContain('onRowRemoveClick')
    expect(page).toContain('bulkRowRemoveActive')
    // Confirmation before API call — Bulk remove opens modal; confirm triggers remove.
    expect(page).toContain(':open="bulkRemoveOpen"')
    expect(page).toContain('@click="openBulkRemove"')
    expect(page).toContain('@confirm="confirmBulkRemove"')
    expect(page).toMatch(/function openBulkRemove[\s\S]*bulkRemoveOpen\.value = true/)
    expect(page).toMatch(
      /async function confirmBulkRemove[\s\S]*bulkRemoveRecipientListMembers/
    )
    expect(page).toMatch(
      /function onRowRemoveClick[\s\S]*bulkRowRemoveActive[\s\S]*openBulkRemove/
    )
  })

  it('client API includes bulkRemoveRecipientListMembers', () => {
    const api = readFileSync(resolve(root, 'app/composables/useTenantMarketingApi.ts'), 'utf8')
    expect(api).toContain('bulkRemoveRecipientListMembers')
    expect(api).toContain('/members/bulk-remove')
  })
})
