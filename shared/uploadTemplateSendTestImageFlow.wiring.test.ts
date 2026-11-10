import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('wiring: upload → template → send test (hosted images)', () => {
  it('Images page uploads via library API', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/images/index.vue'), 'utf8')
    expect(page).toContain('uploadTenantHostedImage')
  })

  it('Insert/Replace picker uploads to same library API and emits hosted url', () => {
    const picker = readFileSync(
      resolve(root, 'app/components/tenant/HostedImagePickerModal.vue'),
      'utf8'
    )
    expect(picker).toContain('uploadTenantHostedImage')
    expect(picker).toContain("emit('select'")
    expect(picker).toContain('isHostedImagePickerUploadDisabled')
    expect(picker).toContain(':disabled="uploadDisabled"')
  })

  it('template editor inserts uploaded image URL into HTML and saves htmlTemplate', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/email-templates/add.vue'), 'utf8')
    expect(page).toContain('uploadEmailTemplateImage')
    expect(page).toContain('applyUploadedTemplateImage')
    expect(page).toContain('emailTemplateImageSnippet')
    expect(page).toContain('createEmailTemplate')
    expect(page).toContain('updateEmailTemplate')
    expect(page).toContain('htmlTemplate: html')
    expect(page).toContain('ensureEmailTemplateUnsubscribe')
  })

  it('send test client passes templateHtml through to API', () => {
    const api = readFileSync(resolve(root, 'app/composables/useTenantMarketingApi.ts'), 'utf8')
    expect(api).toContain('sendTestEmail')
    expect(api).toContain('/api/v1/tenant/send-campaign/test-email')
    expect(api).toContain('templateHtml')

    const hook = readFileSync(resolve(root, 'app/composables/useCampaignTestEmail.ts'), 'utf8')
    expect(hook).toContain('templateHtml: draft.templateHtml')
  })

  it('send-test service merges template then applies preview (does not strip body)', () => {
    const svc = readFileSync(
      resolve(root, 'server/services/send-test-email.service.ts'),
      'utf8'
    )
    expect(svc).toContain('mergeMustacheTemplate(templateHtml')
    expect(svc).toContain('applyEmailPreviewText')
    expect(svc).toContain('htmlContent: htmlRendered')
  })
})
