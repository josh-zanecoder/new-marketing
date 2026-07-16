import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_MARKETING_DEFAULT_BODY,
  CUSTOM_MARKETING_DEFAULT_SUBJECT,
  customMarketingHtmlToPlainText,
  escapeHtmlText,
  isCustomMarketingBodyReady,
  plainTextToCustomMarketingHtml
} from '../customMarketingEmail'
import {
  campaignTemplateHtmlSourceFromMode,
  campaignTemplateModeFromHtmlSource,
  resolveCampaignTemplateHtmlSource
} from '../campaignTemplateSource'

describe('customMarketingEmail', () => {
  it('exposes non-empty default subject and body', () => {
    assert.ok(CUSTOM_MARKETING_DEFAULT_SUBJECT.trim().length > 0)
    assert.ok(CUSTOM_MARKETING_DEFAULT_BODY.trim().length > 0)
  })

  it('escapes HTML special characters', () => {
    assert.equal(escapeHtmlText(`a <b> & "c"`), 'a &lt;b&gt; &amp; &quot;c&quot;')
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

  it('treats empty body as not ready', () => {
    assert.equal(isCustomMarketingBodyReady(''), false)
    assert.equal(isCustomMarketingBodyReady('   '), false)
    assert.equal(isCustomMarketingBodyReady('Hi'), true)
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
