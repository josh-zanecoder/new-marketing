import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_SAVE_ERROR_CONFIRM,
  TEMPLATE_SAVE_ERROR_NAME,
  TEMPLATE_SAVE_ERROR_NAME_REQUIRED,
  TEMPLATE_SAVE_ERROR_SUBJECT,
  TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED
} from '../templateSaveError'

describe('templateSaveError constants', () => {
  it('keeps machine messages for save() matching', () => {
    expect(TEMPLATE_SAVE_ERROR_NAME_REQUIRED).toBe('Template name is required.')
    expect(TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED).toBe('Subject is required.')
  })

  it('exposes friendly presentation for name and subject', () => {
    expect(TEMPLATE_SAVE_ERROR_NAME.title.toLowerCase()).toContain('name')
    expect(TEMPLATE_SAVE_ERROR_NAME.hint.toLowerCase()).toContain('save')
    expect(TEMPLATE_SAVE_ERROR_SUBJECT.title.toLowerCase()).toContain('subject')
    expect(TEMPLATE_SAVE_ERROR_CONFIRM.toLowerCase()).toContain('editing')
  })
})
