import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED,
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER,
  EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL,
  EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER,
  buildEmailTemplateUnsubscribeFooterHtml
} from '~~/shared/emailTemplateUnsubscribe'
import {
  appendEmailTemplateUnsubscribeFooter,
  ensureEmailTemplateUnsubscribe,
  htmlHasUnsubscribePlaceholder,
  htmlHasUnsubscribeUrl
} from '~~/shared/utils/ensureEmailTemplateUnsubscribe'

describe('ensureEmailTemplateUnsubscribe', () => {
  it('keeps templates that already include {{unsubscribe}}', () => {
    const html = '<p>Hi</p><a href="{{ unsubscribe }}">Leave list</a>'
    const result = ensureEmailTemplateUnsubscribe(html)
    expect(result.status).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER)
    expect(result.footerAppended).toBe(false)
    expect(result.html).toBe(html)
    expect(htmlHasUnsubscribePlaceholder(html)).toBe(true)
  })

  it('keeps templates that already include an unsubscribe href', () => {
    const html =
      '<p>Bye</p><a href="https://example.com/api/v1/unsubscribe?token=abc">Unsubscribe</a>'
    const result = ensureEmailTemplateUnsubscribe(html)
    expect(result.status).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL)
    expect(result.footerAppended).toBe(false)
    expect(result.html).toBe(html)
    expect(htmlHasUnsubscribeUrl(html)).toBe(true)
  })

  it('keeps templates that already include a bare unsubscribe URL', () => {
    const html = '<p>Visit https://crm.example.com/marketing/unsubscribe?token=x</p>'
    const result = ensureEmailTemplateUnsubscribe(html)
    expect(result.status).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_URL)
    expect(result.footerAppended).toBe(false)
  })

  it('appends the standard footer when neither placeholder nor URL exists', () => {
    const html = '<html><body><p>Hello</p></body></html>'
    const result = ensureEmailTemplateUnsubscribe(html)
    expect(result.status).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_FOOTER_APPENDED)
    expect(result.footerAppended).toBe(true)
    expect(result.html).toContain(EMAIL_TEMPLATE_UNSUBSCRIBE_FOOTER_MARKER)
    expect(result.html).toContain('{{unsubscribe}}')
    expect(result.html).toMatch(/<p>Hello<\/p>[\s\S]*<\/body>/)
  })

  it('appends before </body> and does not double-append', () => {
    const once = appendEmailTemplateUnsubscribeFooter('<html><body><p>A</p></body></html>')
    expect(once).toContain(buildEmailTemplateUnsubscribeFooterHtml())
    const twice = ensureEmailTemplateUnsubscribe(once)
    expect(twice.footerAppended).toBe(false)
    expect(twice.status).toBe(EMAIL_TEMPLATE_UNSUBSCRIBE_CHECK_HAD_PLACEHOLDER)
    expect(twice.html).toBe(once)
  })

  it('appends at end when there is no </body>', () => {
    const result = ensureEmailTemplateUnsubscribe('<div>Only fragment</div>')
    expect(result.footerAppended).toBe(true)
    expect(result.html.endsWith(buildEmailTemplateUnsubscribeFooterHtml())).toBe(true)
  })
})
