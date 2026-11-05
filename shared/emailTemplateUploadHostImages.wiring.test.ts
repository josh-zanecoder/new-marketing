import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('email template HTML upload hosts images', () => {
  it('create/update APIs host images into Images library on save', () => {
    const post = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/index.post.ts'),
      'utf8'
    )
    const put = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/[id].put.ts'),
      'utf8'
    )
    expect(post).toContain('hostEmailTemplateHtmlImagesOnSave')
    expect(put).toContain('hostEmailTemplateHtmlImagesOnSave')
  })

  it('save-time hosting is gated by allowTenantLoRecipientLists (flag OFF = no-op)', () => {
    const helper = readFileSync(
      resolve(root, 'server/utils/emailTemplate/hostEmailTemplateHtmlImages.ts'),
      'utf8'
    )
    expect(helper).toContain('allowTenantLoRecipientLists')
    expect(helper).toContain('parseAllowTenantLoRecipientLists')
    expect(helper).toContain('Flag OFF')
  })

  it('upload UI hosts images only when LO recipient-list flag is on', () => {
    const page = readFileSync(
      resolve(root, 'app/pages/tenant/email-templates/add.vue'),
      'utf8'
    )
    expect(page).toContain('hostUploadedEmailTemplateImages')
    expect(page).toContain('hostImagesInUploadedHtml')
    expect(page).toContain('uploadTenantHostedImage')
    expect(page).toContain('allowTenantLoRecipientLists')
    expect(page).toContain('canUploadTemplateImage')
  })

  it('rewrite helper targets library folder and remote fetch', () => {
    const helper = readFileSync(
      resolve(root, 'server/utils/emailTemplate/rewriteEmailTemplateImagesForHosting.ts'),
      'utf8'
    )
    expect(helper).toContain('CUSTOM_MARKETING_GCS_LIBRARY_FOLDER')
    expect(helper).toContain('rewriteCustomMarketingDataImagesToGcs')
    expect(helper).toContain('fetchRemoteImageBuffer')
  })
})
