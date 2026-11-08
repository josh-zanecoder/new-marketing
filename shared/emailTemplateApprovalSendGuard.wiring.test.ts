import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('email template approval send guard wiring', () => {
  it('blocks beginCampaignSend, schedule, and test email', () => {
    const begin = readFileSync(
      resolve(root, 'server/services/send-campaign.service.ts'),
      'utf8'
    )
    const schedule = readFileSync(
      resolve(root, 'server/api/v1/tenant/send-campaign/schedule.post.ts'),
      'utf8'
    )
    const testEmail = readFileSync(
      resolve(root, 'server/services/send-test-email.service.ts'),
      'utf8'
    )
    expect(begin).toContain('assertCampaignEmailTemplateApprovedForSend')
    expect(schedule).toContain('assertCampaignEmailTemplateApprovedForSend')
    expect(testEmail).toContain('assertCampaignEmailTemplateApprovedForSend')
  })

  it('campaign edit UI surfaces approval block', () => {
    const edit = readFileSync(
      resolve(root, 'app/pages/tenant/campaigns/edit/[id].vue'),
      'utf8'
    )
    const add = readFileSync(resolve(root, 'app/pages/tenant/campaigns/add.vue'), 'utf8')
    expect(edit).toContain('templateApprovalBlocksSend')
    expect(edit).toContain('Template needs approval')
    expect(edit).toContain('allowTenantLoRecipientLists.value === true')
    expect(add).toContain('templateApprovalBlocksSend')
    expect(add).toContain('allowTenantLoRecipientLists.value === true')
  })
})
