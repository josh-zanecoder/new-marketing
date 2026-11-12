import { describe, expect, it } from 'vitest'
import {
  buildCampaignListFullPreviewContent,
  CAMPAIGN_LIST_FULL_PREVIEW_ACTION_TITLE,
  CAMPAIGN_LIST_FULL_PREVIEW_ARIA_LABEL,
  CAMPAIGN_LIST_FULL_PREVIEW_EMPTY,
  CAMPAIGN_LIST_FULL_PREVIEW_FALLBACK_NAME,
  CAMPAIGN_LIST_FULL_PREVIEW_LOAD_ERROR
} from '../campaignListFullPreview'

describe('campaignListFullPreview', () => {
  it('exposes list action and empty/error copy', () => {
    expect(CAMPAIGN_LIST_FULL_PREVIEW_ACTION_TITLE).toBe('Full preview')
    expect(CAMPAIGN_LIST_FULL_PREVIEW_ARIA_LABEL).toBe('Full email preview')
    expect(CAMPAIGN_LIST_FULL_PREVIEW_EMPTY).toContain('no email content')
    expect(CAMPAIGN_LIST_FULL_PREVIEW_LOAD_ERROR).toContain('Could not load')
  })

  it('merges subject and html without mutating the source', () => {
    const source = {
      name: 'Spring promo',
      subject: 'Hello {{user.firstName}}',
      previewText: 'Preview for {{recipient.email}}',
      templateHtml: '<p>Hi {{user.firstName}}</p>'
    }
    const before = structuredClone(source)
    const content = buildCampaignListFullPreviewContent(source, {
      user: { firstName: 'Ada' },
      recipient: { email: 'ada@example.com' }
    })

    expect(content).toEqual({
      name: 'Spring promo',
      subject: 'Hello Ada',
      html: '<p>Hi Ada</p>',
      previewText: 'Preview for ada@example.com',
      hasHtml: true
    })
    expect(source).toEqual(before)
  })

  it('marks empty templateHtml as not previewable and uses fallback name', () => {
    const content = buildCampaignListFullPreviewContent(
      { name: '  ', subject: 'Hi', templateHtml: '   ' },
      {}
    )
    expect(content.hasHtml).toBe(false)
    expect(content.html).toBe('')
    expect(content.name).toBe(CAMPAIGN_LIST_FULL_PREVIEW_FALLBACK_NAME)
    expect(content.subject).toBe('Hi')
  })
})
