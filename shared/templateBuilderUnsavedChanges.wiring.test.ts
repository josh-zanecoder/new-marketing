import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('template builder unsaved changes wiring', () => {
  it('page uses the unsaved guard, modal, and dirty helper', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/template-builder/index.vue'), 'utf8')
    expect(page).toContain('useUnsavedTemplateGuard')
    expect(page).toContain('isEmailTemplateDirty')
    expect(page).toContain('TenantUnsavedTemplateChangesModal')
    expect(page).toContain('TenantTemplateSaveErrorModal')
    expect(page).toContain('reportSaveError')
    expect(page).toContain(':error="formError"')
    expect(page).toContain('allowLeaveOrReplace')
    expect(page).toContain('onBeforeRouteLeave')
    expect(page).toContain('beforeunload')
    expect(page).toContain(':has-unsaved-changes="isDirty"')
    expect(page).toContain('@request-load-template="onRequestLoadTemplate"')
    expect(page).not.toContain('window.confirm(')
    expect(page).not.toContain('v-if="formError"')
  })

  it('unsaved modal shows a calm save-failure callout', () => {
    const modal = readFileSync(
      resolve(root, 'app/components/tenant/UnsavedTemplateChangesModal.vue'),
      'utf8'
    )
    expect(modal).toContain('error?: string')
    expect(modal).toContain('role="alert"')
    expect(modal).toContain('resolveTemplateSaveErrorPresentation')
    expect(modal).toContain('saveErrorView.title')
  })

  it('save-error modal maps raw messages to friendly copy', () => {
    const modal = readFileSync(
      resolve(root, 'app/components/tenant/TemplateSaveErrorModal.vue'),
      'utf8'
    )
    expect(modal).toContain('resolveTemplateSaveErrorPresentation')
    expect(modal).toContain('presentation.title')
    expect(modal).toContain('presentation.hint')
    expect(modal).toContain('TEMPLATE_SAVE_ERROR_CONFIRM')
  })

  it('image builder asks the parent before loading when dirty', () => {
    const builder = readFileSync(
      resolve(root, 'app/components/tenant/EmailTemplateImageBuilder.vue'),
      'utf8'
    )
    expect(builder).toContain('hasUnsavedChanges?: boolean')
    expect(builder).toContain("'request-load-template': [id: string]")
    expect(builder).toContain('emit(\'request-load-template\'')
    expect(builder).toContain('applyLoadTemplate')
    expect(builder).toContain('defineExpose')
  })
})
