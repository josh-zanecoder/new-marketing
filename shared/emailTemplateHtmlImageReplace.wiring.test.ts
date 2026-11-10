import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('email template HTML image insert and replace', () => {
  it('add/edit page inserts and replaces an image on an existing template', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/email-templates/add.vue'), 'utf8')
    expect(page).toContain('uploadEmailTemplateImage')
    expect(page).toContain('showTemplateImageReplace')
    expect(page).toContain('listEmailTemplateHtmlImages')
    expect(page).toContain('replaceEmailTemplateHtmlImageSrc')
    expect(page).toContain('openReplaceImagePicker')
    expect(page).toContain('openInsertImagePicker')
    expect(page).toContain('onTemplateImageFile')
    expect(page).toContain('Insert image')
    expect(page).toContain('Images in this template')
    expect(page).toContain('Replace')
    expect(page).toContain('allowTenantInsertImage')
    expect(page).toContain('canInsertTemplateImage')
    expect(page).not.toContain('allowTenantImages')
    expect(page).not.toContain('canUploadTemplateImage')
  })

  it('template image upload requires the Insert image permission', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/images.post.ts'),
      'utf8'
    )
    expect(api).toContain('EMAIL_TEMPLATE_GCS_IMAGE_FOLDER')
    expect(api).toContain('requireTenantInsertImage')
    expect(api).not.toContain('allowTenantImages')
  })
})
