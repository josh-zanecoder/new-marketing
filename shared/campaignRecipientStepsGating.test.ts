import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The step-by-step recipients flow belongs to tenants with Advanced Recipient Filtering only.
 * Everyone else must keep the original two-option picker (list / manual) untouched.
 */
describe('recipients step flow is gated by Advanced Recipient Filtering', () => {
  for (const file of [
    'app/pages/tenant/campaigns/add.vue',
    'app/pages/tenant/campaigns/edit/[id].vue'
  ]) {
    describe(file, () => {
      const source = readFileSync(file, 'utf8')

      it('shows the new method picker only with the permission', () => {
        const idx = source.indexOf('<TenantCampaignRecipientMethodPicker')
        expect(idx).toBeGreaterThan(-1)
        expect(source.slice(idx, idx + 200)).toContain('v-if="allowTenantAdvancedRecipientFiltering"')
      })

      it('keeps the original list / manual cards for everyone else', () => {
        expect(source).toContain('v-if="!allowTenantAdvancedRecipientFiltering"')
        expect(source).toContain('Use a list')
        expect(source).toContain('Enter manually')
      })

      it('never offers "Filter contacts" through the original cards', () => {
        const legacyStart = source.indexOf('v-if="!allowTenantAdvancedRecipientFiltering"')
        const legacyEnd = source.indexOf("v-if=\"allowTenantAdvancedRecipientFiltering && ", legacyStart)
        const legacy = source.slice(legacyStart, legacyEnd)
        expect(legacy).not.toContain("recipientsMode = 'filters'")
      })
    })
  }

  it('the add page only holds back step two for permitted tenants', () => {
    const source = readFileSync('app/pages/tenant/campaigns/add.vue', 'utf8')
    expect(source).toContain(
      '() => !allowTenantAdvancedRecipientFiltering.value || recipientsMethodChosen.value'
    )
  })

  it('keeps the new preview modal and buttons gated on the add page', () => {
    const source = readFileSync('app/pages/tenant/campaigns/add.vue', 'utf8')
    const modalIdx = source.indexOf('<TenantCampaignRecipientPreviewModal')
    expect(modalIdx).toBeGreaterThan(-1)
    expect(source.slice(modalIdx, modalIdx + 200)).toContain(
      'v-if="allowTenantAdvancedRecipientFiltering &&'
    )
  })
})

describe('server routes enforce allowTenantAdvancedRecipientFiltering', () => {
  for (const route of [
    'server/api/v1/tenant/recipient-list/preview.post.ts',
    'server/api/v1/tenant/recipient-list/audience-options.get.ts',
    'server/api/v1/tenant/recipient-list/builtin-filters.get.ts',
    'server/api/v1/tenant/campaigns/index.post.ts',
    'server/api/v1/tenant/campaigns/[id].put.ts'
  ]) {
    it(`${route} calls requireTenantAdvancedRecipientFiltering`, () => {
      const source = readFileSync(route, 'utf8')
      expect(source).toContain('requireTenantAdvancedRecipientFiltering(event)')
    })
  }

  it('campaigns/index.post.ts also gates liveListAudience without filters', () => {
    const source = readFileSync('server/api/v1/tenant/campaigns/index.post.ts', 'utf8')
    expect(source).toContain('if (liveListAudience &&')
  })

  it('regular recipient-list create/patch never pass allowAdvancedAudience', () => {
    for (const route of [
      'server/api/v1/tenant/recipient-list/index.post.ts',
      'server/api/v1/tenant/recipient-list/[id].patch.ts'
    ]) {
      const source = readFileSync(route, 'utf8')
      expect(source).not.toContain('allowAdvancedAudience')
    }
  })
})
