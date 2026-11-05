import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('unknown typed sender email uses company name', () => {
  it('picker emits typed email after modelValue so sync is not stale', () => {
    const picker = readFileSync(
      resolve(root, 'app/components/campaign/CampaignSenderEmailPicker.vue'),
      'utf8'
    )
    expect(picker).toContain("emit('update:modelValue', next)")
    expect(picker).toContain("emit('typed', next)")
  })

  it('campaign pages sync typed email override into sender name', () => {
    for (const rel of [
      'app/pages/tenant/campaigns/add.vue',
      'app/pages/tenant/campaigns/edit/[id].vue'
    ]) {
      const page = readFileSync(resolve(root, rel), 'utf8')
      expect(page).toContain('syncSenderNameForTypedEmail(emailOverride?: string)')
      expect(page).toContain('function onSenderEmailTyped(email?: string)')
      expect(page).toContain('void syncSenderNameForTypedEmail(email)')
    }
  })

  it('contact_owner From does not paste operator name onto a different address', () => {
    const helper = readFileSync(
      resolve(root, 'server/utils/email/replyToFromContactMetadata.ts'),
      'utf8'
    )
    expect(helper).toContain('operatorNameIfFromSelf')
    expect(helper).toContain('email === operatorEmail')
  })
})
