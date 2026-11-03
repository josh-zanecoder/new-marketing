import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('LO-flag Save campaign validation wiring (classic path unchanged)', () => {
  for (const rel of [
    'app/pages/tenant/campaigns/add.vue',
    'app/pages/tenant/campaigns/edit/[id].vue'
  ] as const) {
    it(`${rel}: LO flag keeps Save enabled and validates on click`, () => {
      const page = readFileSync(resolve(root, rel), 'utf8')
      expect(page).toContain('allowTenantLoRecipientLists')
      expect(page).toContain('campaignSaveMissingFieldsMessage')
      expect(page).toContain('saveCampaignActionDisabled')
      // Classic still gates the button on readyToSaveCampaign when flag is off.
      expect(page).toContain('readyToSaveCampaign')
      expect(page).toMatch(
        /allowTenantLoRecipientLists\.value !== true[\s\S]*!readyToSaveCampaign\.value/
      )
    })
  }
})
