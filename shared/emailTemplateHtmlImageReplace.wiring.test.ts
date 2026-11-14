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

  it('Replace has its own permission in the HTML editor and every builder', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/email-templates/add.vue'), 'utf8')
    expect(page).toContain('canReplaceTemplateImage')
    expect(page).toContain('v-if="canReplaceTemplateImage"')
    for (const path of [
      'app/pages/tenant/email-templates/add.vue',
      'app/pages/tenant/email-editor/index.vue',
      'app/pages/tenant/template-builder/index.vue'
    ]) {
      expect(readFileSync(resolve(root, path), 'utf8')).toContain(':can-replace-image="allowTenantReplaceImage"')
    }
    const builder = readFileSync(resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    expect(builder).toContain('if (!props.canReplaceImage) return')
  })

  it('Template Builder upload only adds to the Uploads library', () => {
    const builder = readFileSync(resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    const start = builder.indexOf('async function onFile(')
    const end = builder.indexOf('\nfunction ', start)
    const onFile = builder.slice(start, end)
    expect(start).toBeGreaterThan(-1)
    expect(onFile.match(/insertImage\(url\)/g)).toHaveLength(1)
    expect(onFile).toMatch(/else if \(imageBlockPending\.value\) \{[^}]*insertImage\(url\)/)
    expect(onFile).toContain('await loadHostedImages()')
    expect(builder).not.toContain('startInsert')
    expect(builder.match(/@click="startLibraryUpload"/g)).toHaveLength(2)
  })

  it('right-click never starts a drag and Esc cancels an active one', () => {
    const builder = readFileSync(resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    const down = builder.slice(builder.indexOf('function onFramePointerDown('))
    expect(down.slice(0, 400)).toMatch(/if \(event\.button !== 0\) \{\s*cancelActiveGesture\(\)\s*return/)
    const parentDown = builder.slice(builder.indexOf('function onParentResizeDown('))
    expect(parentDown.slice(0, 400)).toContain('if (event.button !== 0) return')

    expect(builder).toContain("doc.addEventListener('keydown', onGestureEscape, true)")
    expect(builder).toContain("window.addEventListener('keydown', onGestureEscape, true)")
    expect(builder).toContain("doc.addEventListener('contextmenu', onGestureInterrupted, true)")
    expect(builder).toContain("window.addEventListener('contextmenu', onGestureInterrupted, true)")
    expect(builder).not.toContain("window.addEventListener('blur'")
    expect(builder).toMatch(/event\.pointerType !== 'mouse' \|\| event\.buttons !== 0/)

    const cancel = builder.slice(builder.indexOf('function cancelActiveGesture('))
    const body = cancel.slice(0, cancel.indexOf('\n}\n'))
    expect(body).toContain('writeDragStyle(section.el, section.priorStyle)')
    expect(body).toContain("img.setAttribute('style', imageGesturePriorStyle)")
    expect(body).toContain('reloadPreviewFromModel()')
    expect(body).not.toContain("emit('update:modelValue'")
    expect(builder.match(/doc\.body\.setPointerCapture\(/g)).toHaveLength(1)
  })

  it('clicking an upload only selects it; Insert image adds it', () => {
    const builder = readFileSync(resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    const start = builder.indexOf('function onHostedClick(')
    const onClick = builder.slice(start, builder.indexOf('\nfunction ', start + 1))
    expect(start).toBeGreaterThan(-1)
    expect(onClick).not.toContain('insertImage(')
    expect(onClick).toContain('selectedHostedId.value')
    expect(builder).not.toContain('onHostedClick(item.url)')

    const insertStart = builder.indexOf('function insertSelectedHosted(')
    const insert = builder.slice(insertStart, builder.indexOf('\n}', insertStart))
    expect(insert.indexOf('selectedHostedId.value = null')).toBeLessThan(insert.indexOf('insertImage('))

    expect(builder).toContain('@click="insertSelectedHosted"')
    expect(builder).toContain('@click="clearHostedSelection"')
    expect(builder).toContain(':aria-pressed="selectedHostedId === item.id"')
    expect(builder).toMatch(/sidePanel\.value === 'uploads' && selectedHosted\.value/)
  })

  it('Template Builder Uploads can delete an image after confirmation', () => {
    const builder = readFileSync(resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    const api = readFileSync(
      resolve(root, 'server/api/v1/tenant/email-templates/images.delete.ts'),
      'utf8'
    )
    expect(builder).toContain('v-if="item.canDelete"')
    expect(builder).toContain('@click.stop="askDeleteHostedImage(item)"')
    expect(builder).toContain('title="Delete image?"')
    expect(builder).toContain('@confirm="confirmDeleteHostedImage"')
    expect(builder).toContain('marketingApi.deleteEmailTemplateImage(item.objectPath)')
    expect(builder).toContain('hostedImageInEmail(item)')
    expect(api).toContain('requireTenantEmailTemplateImageHost')
    expect(api.indexOf('findEmailTemplatesUsingHostedImage(')).toBeLessThan(
      api.indexOf('deleteCustomMarketingTenantImages(')
    )
    expect(api).toContain('statusCode: 409')
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
