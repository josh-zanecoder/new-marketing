import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('campaign Sender name from LO recipient list', () => {
  it('resolves first+last only when allowTenantLoRecipientLists is ON', () => {
    for (const rel of [
      'app/pages/tenant/campaigns/add.vue',
      'app/pages/tenant/campaigns/edit/[id].vue'
    ]) {
      const page = readFileSync(resolve(root, rel), 'utf8')
      expect(page).toContain('allowTenantLoRecipientLists')
      expect(page).toContain('isEmailShapedSenderDisplayName')
      expect(page).toContain('resolveSelectedListSenderDisplayName')
      // Must not reuse typed sync (that can flip senderMode to contact_owner).
      expect(page).toMatch(
        /Must NOT reuse syncSenderNameForTypedEmail/
      )
      // List → sender name lookup must be flag-gated (classic path unchanged).
      expect(page).toMatch(
        /allowTenantLoRecipientLists\.value === true &&\s*isEmailShapedSenderDisplayName\(listName,\s*email\)/
      )
      expect(page).toContain('resolveSelectedListSenderDisplayName(email)')
      // Picker select: LO flag prefers first+last; else classic displayName || email.
      expect(page).toContain('c.displayName || c.email')
      expect(page).toMatch(
        /allowTenantLoRecipientLists\.value === true[\s\S]*fromParts/
      )
    }
  })

  it('LO list form name resolution lives only in the LO simple form composable', () => {
    const form = readFileSync(
      resolve(root, 'app/composables/useLoRecipientListSimpleForm.ts'),
      'utf8'
    )
    expect(form).toContain('allowTenantLoRecipientLists')
    expect(form).toContain('displayNameFromLoanOfficerCandidate')
    expect(form).toContain('resolveAssociatedLoanOfficerNameFromDirectory')
    expect(form).toContain('isEmailShapedSenderDisplayName')
    // Classic recipient-list form must stay untouched.
    const classic = readFileSync(
      resolve(root, 'app/composables/useRecipientListForm.ts'),
      'utf8'
    )
    expect(classic).not.toContain('resolveAssociatedLoanOfficerNameFromDirectory')
    expect(classic).not.toContain('isEmailShapedSenderDisplayName')
  })

  it('shared typed-name resolver uses tenant optional Sender name (empty stays empty)', () => {
    const helper = readFileSync(
      resolve(root, 'shared/resolveTypedCampaignSenderName.ts'),
      'utf8'
    )
    // Order: matched → session → tenant optional Sender name (empty stays empty).
    expect(helper).toContain('if (matchedName) return matchedName')
    expect(helper).toContain('return defaultName')
    expect(helper).toContain('empty means empty')
  })
})
