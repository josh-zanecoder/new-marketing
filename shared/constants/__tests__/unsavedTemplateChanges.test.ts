import { describe, expect, it } from 'vitest'
import {
  UNSAVED_TEMPLATE_CHANGES_DISCARD,
  UNSAVED_TEMPLATE_CHANGES_MESSAGE,
  UNSAVED_TEMPLATE_CHANGES_SAVE,
  UNSAVED_TEMPLATE_CHANGES_STAY,
  UNSAVED_TEMPLATE_CHANGES_TITLE
} from '../unsavedTemplateChanges'

describe('unsavedTemplateChanges constants', () => {
  it('exposes dialog copy for stay, discard, and save', () => {
    expect(UNSAVED_TEMPLATE_CHANGES_TITLE).toBeTruthy()
    expect(UNSAVED_TEMPLATE_CHANGES_MESSAGE.toLowerCase()).toContain('unsaved')
    expect(UNSAVED_TEMPLATE_CHANGES_STAY).toBe('Stay')
    expect(UNSAVED_TEMPLATE_CHANGES_DISCARD.toLowerCase()).toContain('discard')
    expect(UNSAVED_TEMPLATE_CHANGES_SAVE.toLowerCase()).toContain('save')
  })
})
