import { describe, expect, it } from 'vitest'
import {
  EMAIL_PREVIEW_TEXT_MAX,
  applyEmailPreviewText,
  normalizeEmailPreviewText
} from '../emailPreviewText'

describe('email preview text', () => {
  it('trims and caps the snippet', () => {
    expect(normalizeEmailPreviewText('  hello   there  ')).toBe('hello there')
    expect(normalizeEmailPreviewText('a'.repeat(200))).toHaveLength(EMAIL_PREVIEW_TEXT_MAX)
  })

  it('inserts a hidden preheader after the body tag', () => {
    const html = applyEmailPreviewText('<html><body><p>Hi</p></body></html>', 'Rates this week')
    expect(html.indexOf('data-email-preview-text="1"')).toBeGreaterThan(-1)
    expect(html.indexOf('Rates this week')).toBeLessThan(html.indexOf('<p>Hi</p>'))
  })

  it('escapes markup in the snippet', () => {
    const html = applyEmailPreviewText('<p>Hi</p>', '<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('leaves html unchanged when preview text is empty or already present', () => {
    expect(applyEmailPreviewText('<p>Hi</p>', '   ')).toBe('<p>Hi</p>')
    const once = applyEmailPreviewText('<p>Hi</p>', 'Snippet')
    expect(applyEmailPreviewText(once, 'Other')).toBe(once)
  })
})
