import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_MARKETING_DEFAULT_BODY,
  CUSTOM_MARKETING_DEFAULT_BODY_HTML,
  CUSTOM_MARKETING_DEFAULT_SUBJECT,
  customMarketingHtmlToPlainText,
  escapeHtmlText,
  isCustomMarketingBodyReady,
  isCustomMarketingContentReady,
  plainTextToCustomMarketingEditorHtml,
  plainTextToCustomMarketingHtml,
  resolveCustomMarketingSendHtml,
  stripHtmlToPlainText,
  wrapCustomMarketingRichHtml
} from '../customMarketingEmail'
import {
  campaignTemplateHtmlSourceFromMode,
  campaignTemplateModeFromHtmlSource,
  resolveCampaignTemplateHtmlSource
} from '../campaignTemplateSource'
import {
  CUSTOM_MARKETING_FONT_FAMILIES,
  CUSTOM_MARKETING_FONT_SIZES,
  CUSTOM_MARKETING_MAX_IMAGE_BYTES,
  isAllowedCustomMarketingImageMime,
  textStyleAttrsMatch,
  customMarketingSenderInitials,
  customMarketingInboxDateLabel,
  customMarketingBrowserAddressUrl
} from '../customMarketingEditorOptions'

describe('customMarketingEmail', () => {
  it('exposes non-empty default subject and body', () => {
    assert.ok(CUSTOM_MARKETING_DEFAULT_SUBJECT.trim().length > 0)
    assert.ok(CUSTOM_MARKETING_DEFAULT_BODY.trim().length > 0)
    assert.ok(CUSTOM_MARKETING_DEFAULT_BODY_HTML.includes('<p>'))
  })

  it('escapes HTML special characters', () => {
    assert.equal(escapeHtmlText(`a <b> & "c"`), 'a &lt;b&gt; &amp; &quot;c&quot;')
  })

  it('builds TipTap editor HTML from plain text', () => {
    const fragment = plainTextToCustomMarketingEditorHtml('Hello\n\nThanks.')
    assert.ok(fragment.includes('<p>Hello</p>'))
    assert.ok(fragment.includes('<p>Thanks.</p>'))
    assert.equal(fragment.includes('<!DOCTYPE'), false)
  })

  it('wraps rich HTML fragment in email document', () => {
    const html = wrapCustomMarketingRichHtml('<p style="font-size:16px">Hi</p><img src="data:image/png;base64,abc">')
    assert.ok(html.includes('<!DOCTYPE html>'))
    assert.ok(html.includes('background:#ffffff'))
    assert.ok(html.includes('font-size:16px'))
    assert.ok(html.includes('<img src="data:image/png;base64,abc">'))
  })

  it('converts plain text paragraphs into minimal personal-style HTML', () => {
    const html = plainTextToCustomMarketingHtml('Hello {{ recipient.firstName }},\n\nThanks.')
    assert.ok(html.includes('<!DOCTYPE html>'))
    assert.ok(html.includes('background:#ffffff'))
    assert.ok(html.includes('Hello {{ recipient.firstName }},'))
    assert.ok(html.includes('Thanks.'))
    assert.equal(html.includes('<script'), false)
  })

  it('round-trips plain text through HTML for re-editing', () => {
    const plain = 'Dear Ernesto,\n\nCongrats on passing.\n\nBest regards,\nSon Rhey'
    const html = plainTextToCustomMarketingHtml(plain)
    const back = customMarketingHtmlToPlainText(html)
    assert.ok(back.includes('Dear Ernesto,'))
    assert.ok(back.includes('Congrats on passing.'))
    assert.ok(back.includes('Son Rhey'))
  })

  it('treats empty body as not ready and image-only as ready', () => {
    assert.equal(isCustomMarketingBodyReady(''), false)
    assert.equal(isCustomMarketingBodyReady('   '), false)
    assert.equal(isCustomMarketingBodyReady('<p></p>'), false)
    assert.equal(isCustomMarketingBodyReady('Hi'), true)
    assert.equal(isCustomMarketingBodyReady('<p>Hi</p>'), true)
    assert.equal(isCustomMarketingBodyReady('<p><img src="data:image/png;base64,x"></p>'), true)
  })

  it('strips HTML to plain text', () => {
    assert.equal(stripHtmlToPlainText('<p>Hello<br>World</p>'), 'Hello\nWorld')
  })

  it('resolves send HTML from write rich body or uploaded template', () => {
    const fromWrite = resolveCustomMarketingSendHtml({
      contentSource: 'write',
      bodyHtml: '<p style="font-family:Arial">Hello</p>',
      uploadedHtml: '<p>ignored</p>'
    })
    assert.ok(fromWrite.includes('<!DOCTYPE html>'))
    assert.ok(fromWrite.includes('Hello'))
    assert.ok(fromWrite.includes('font-family:Arial'))
    const fromUpload = resolveCustomMarketingSendHtml({
      contentSource: 'upload',
      bodyHtml: '<p>Hello</p>',
      uploadedHtml: '<html><body>Template</body></html>'
    })
    assert.equal(fromUpload, '<html><body>Template</body></html>')
  })

  it('requires uploaded HTML when content source is upload', () => {
    assert.equal(
      isCustomMarketingContentReady({ contentSource: 'upload', bodyHtml: 'Hi', uploadedHtml: '' }),
      false
    )
    assert.equal(
      isCustomMarketingContentReady({
        contentSource: 'upload',
        bodyHtml: '',
        uploadedHtml: '<p>ok</p>'
      }),
      true
    )
  })
})

describe('customMarketingEditorOptions', () => {
  it('exposes font family and size choices', () => {
    assert.ok(CUSTOM_MARKETING_FONT_FAMILIES.length >= 30)
    assert.ok(CUSTOM_MARKETING_FONT_SIZES.length >= 20)
    assert.ok(CUSTOM_MARKETING_MAX_IMAGE_BYTES > 0)
    const labels = CUSTOM_MARKETING_FONT_FAMILIES.map((f) => f.label)
    assert.ok(labels.includes('Arial'))
    assert.ok(labels.includes('Helvetica Neue'))
    assert.ok(labels.includes('Palatino'))
    assert.ok(labels.includes('Garamond'))
    assert.ok(labels.includes('Consolas'))
    assert.ok(labels.includes('Brush Script MT'))
    const sizes = CUSTOM_MARKETING_FONT_SIZES.map((s) => s.value)
    assert.ok(sizes.includes('8px'))
    assert.ok(sizes.includes('14px'))
    assert.ok(sizes.includes('72px'))
  })

  it('allows common image mime types only', () => {
    assert.equal(isAllowedCustomMarketingImageMime('image/png'), true)
    assert.equal(isAllowedCustomMarketingImageMime('image/jpeg'), true)
    assert.equal(isAllowedCustomMarketingImageMime('application/pdf'), false)
  })

  it('detects when toolbar text style attrs already match', () => {
    const next = {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '24px',
      color: '#222222'
    }
    assert.equal(textStyleAttrsMatch(next, next), true)
    assert.equal(textStyleAttrsMatch({ ...next, fontSize: '14px' }, next), false)
  })

  it('builds inbox preview initials and date label', () => {
    assert.equal(customMarketingSenderInitials('Forge Capital', 'a@b.com'), 'FC')
    assert.equal(customMarketingSenderInitials('', 'marketing@example.com'), 'MA')
    assert.match(customMarketingInboxDateLabel(new Date('2026-07-17T15:08:00')), /^Today, /)
    assert.equal(
      customMarketingBrowserAddressUrl('A quick note'),
      'https://mail.google.com/mail/u/0/#inbox/a-quick-note'
    )
  })
})

describe('campaignTemplateSource custom mode', () => {
  it('maps custom template mode to custom html source', () => {
    assert.equal(campaignTemplateHtmlSourceFromMode('custom'), 'custom')
    assert.equal(campaignTemplateHtmlSourceFromMode('upload'), 'upload')
    assert.equal(campaignTemplateHtmlSourceFromMode('scratch'), 'editor')
    assert.equal(campaignTemplateHtmlSourceFromMode('existing'), 'editor')
  })

  it('maps custom html source back to custom template mode', () => {
    assert.equal(campaignTemplateModeFromHtmlSource('custom'), 'custom')
    assert.equal(campaignTemplateModeFromHtmlSource('upload'), 'upload')
    assert.equal(campaignTemplateModeFromHtmlSource('editor'), 'scratch')
  })

  it('resolves raw html source strings', () => {
    assert.equal(resolveCampaignTemplateHtmlSource('custom'), 'custom')
    assert.equal(resolveCampaignTemplateHtmlSource('upload'), 'upload')
    assert.equal(resolveCampaignTemplateHtmlSource(undefined), 'editor')
  })
})
