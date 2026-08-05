import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_PREVIEW,
  CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_TITLE
} from '~~/shared/campaignUnsubscribeSecondCheck'
import { ensureEmailTemplateUnsubscribe } from '~~/shared/utils/ensureEmailTemplateUnsubscribe'

describe('campaign unsubscribe second check', () => {
  it('exposes approve / decline / preview copy', () => {
    expect(CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_TITLE.length).toBeGreaterThan(0)
    expect(CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_APPROVE).toBe('Approve')
    expect(CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_DECLINE).toBe('Decline')
    expect(CAMPAIGN_UNSUBSCRIBE_SECOND_CHECK_PREVIEW).toBe('Preview')
  })

  it('treats missing unsubscribe as footer append for pre-send pause', () => {
    const check = ensureEmailTemplateUnsubscribe('<p>Hello campaign</p>')
    expect(check.footerAppended).toBe(true)
    expect(check.html).toContain('{{unsubscribe}}')
  })

  it('auto-approves when placeholder already present', () => {
    const check = ensureEmailTemplateUnsubscribe(
      '<p>Hi</p><a href="{{unsubscribe}}">Unsubscribe</a>'
    )
    expect(check.footerAppended).toBe(false)
  })

  it('appends footer to custom marketing write-mode HTML without unsubscribe', () => {
    const html = [
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head>',
      '<body style="margin:0;padding:16px;"><p>Dear friend,</p></body></html>'
    ].join('')
    const check = ensureEmailTemplateUnsubscribe(html)
    expect(check.footerAppended).toBe(true)
    expect(check.html).toContain('{{unsubscribe}}')
    expect(check.html).toMatch(/Dear friend[\s\S]*<\/body>/)
  })
})
