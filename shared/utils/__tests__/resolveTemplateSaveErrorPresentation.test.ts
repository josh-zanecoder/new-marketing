import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_SAVE_ERROR_GENERIC,
  TEMPLATE_SAVE_ERROR_NAME_REQUIRED,
  TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED
} from '../../constants/templateSaveError'
import { resolveTemplateSaveErrorPresentation } from '../resolveTemplateSaveErrorPresentation'

describe('resolveTemplateSaveErrorPresentation', () => {
  it('explains missing name with a next step', () => {
    const view = resolveTemplateSaveErrorPresentation(TEMPLATE_SAVE_ERROR_NAME_REQUIRED)
    expect(view.title.toLowerCase()).toContain('name')
    expect(view.hint.toLowerCase()).toContain('template name')
  })

  it('explains missing subject', () => {
    const view = resolveTemplateSaveErrorPresentation(TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED)
    expect(view.title.toLowerCase()).toContain('subject')
  })

  it('uses a calm fallback for generic failures', () => {
    const view = resolveTemplateSaveErrorPresentation(TEMPLATE_SAVE_ERROR_GENERIC)
    expect(view.body.toLowerCase()).toContain('still in the editor')
  })
})
