import { describe, expect, it } from 'vitest'
import { isEmailTemplateDirty } from '../isEmailTemplateDirty'

describe('isEmailTemplateDirty', () => {
  const saved = { html: '<p>Hi</p>', name: 'Welcome', subject: 'Hello' }

  it('is false when nothing changed', () => {
    expect(isEmailTemplateDirty(saved, saved)).toBe(false)
  })

  it('ignores name/subject surrounding whitespace', () => {
    expect(
      isEmailTemplateDirty(
        { html: saved.html, name: '  Welcome  ', subject: ' Hello ' },
        saved
      )
    ).toBe(false)
  })

  it('detects html, name, and subject edits', () => {
    expect(isEmailTemplateDirty({ ...saved, html: '<p>Bye</p>' }, saved)).toBe(true)
    expect(isEmailTemplateDirty({ ...saved, name: 'Other' }, saved)).toBe(true)
    expect(isEmailTemplateDirty({ ...saved, subject: 'Other' }, saved)).toBe(true)
  })
})
