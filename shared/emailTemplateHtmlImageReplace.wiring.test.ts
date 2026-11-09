import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('email template HTML image replace (Images flag path)', () => {
  it('add/edit page inserts/replaces from Images library behind canUploadTemplateImage', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/email-templates/add.vue'), 'utf8')
    expect(page).toContain('canUploadTemplateImage')
    expect(page).toContain('allowTenantImages')
    expect(page).toContain('showTemplateImageReplace')
    expect(page).toContain('listEmailTemplateHtmlImages')
    expect(page).toContain('replaceEmailTemplateHtmlImageSrc')
    expect(page).toContain('openReplaceImagePicker')
    expect(page).toContain('openInsertImagePicker')
    expect(page).toContain('TenantHostedImagePickerModal')
    expect(page).toContain('Insert image')
    expect(page).toContain('Images in this template')
    expect(page).toContain('Replace')
    expect(page).not.toContain('uploadEmailTemplateImage')

    const picker = readFileSync(
      resolve(root, 'app/components/tenant/HostedImagePickerModal.vue'),
      'utf8'
    )
    expect(picker).toContain('uploadTenantHostedImage')
    expect(picker).toContain('Upload from device')
    expect(picker).toContain('compressCustomMarketingImageFile')
  })

  it('upload API remains Images-flag gated', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/images.post.ts'),
      'utf8'
    )
    expect(api).toContain('allowTenantImages')
  })
})
