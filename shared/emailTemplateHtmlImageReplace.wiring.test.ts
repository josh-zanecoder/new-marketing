import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('email template HTML image insert and replace', () => {
  it('the HTML editor keeps insert and replace behind Insert image', () => {
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
    expect(page).toContain(':can-upload-image="true"')
    expect(page).not.toContain('allowTenantImages')
    expect(page).not.toContain('canUploadTemplateImage')
  })

  it('the template editor does not use the Insert image permission', () => {
    const editor = readFileSync(resolve(root, 'app/pages/tenant/email-editor/index.vue'), 'utf8')
    expect(editor).toContain(':can-upload-image="true"')
    expect(editor).not.toContain('allowTenantInsertImage')
  })

  it('template image upload allows the template editor without Insert image', () => {
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/images.post.ts'),
      'utf8'
    )
    const gate = readFileSync(
      resolve(root, 'server/utils/requireTenantInsertImage.ts'),
      'utf8'
    )
    expect(api).toContain('EMAIL_TEMPLATE_GCS_IMAGE_FOLDER')
    expect(api).toContain('requireTenantEmailTemplateImageHost')
    expect(api).not.toContain('await requireTenantInsertImage')
    expect(api).not.toContain('allowTenantImages')
    expect(gate).toContain('allowTenantTemplateBuilder')
    expect(gate).toContain('allowTenantInsertImage')
  })
})
