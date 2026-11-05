import { describe, expect, it } from 'vitest'
import {
  isEmailTemplateAlreadyHostedImageUrl,
  planEmailTemplateHostableImages,
  emailTemplateHtmlNeedsImageHosting
} from '../emailTemplateHostableImages'
import { hostUploadedEmailTemplateImages } from '../hostUploadedEmailTemplateImages'
import { replaceCustomMarketingImageSrc } from '../../customMarketingHostedImages'

describe('emailTemplateHostableImages', () => {
  it('detects already-hosted GCS library URLs', () => {
    expect(
      isEmailTemplateAlreadyHostedImageUrl(
        'https://storage.googleapis.com/custom-marketing-images/custom-marketing/demo/library/a.jpg'
      )
    ).toBe(true)
    expect(isEmailTemplateAlreadyHostedImageUrl('https://cdn.example.com/a.jpg')).toBe(false)
  })

  it('plans data URLs, remote URLs, and skips relative/cid', () => {
    const html = `
      <img src="data:image/png;base64,aaa">
      <img src="https://cdn.example.com/hero.jpg">
      <img src="images/local.png">
      <img src="cid:logo@mail">
      <img src="https://storage.googleapis.com/custom-marketing-images/custom-marketing/t/library/x.png">
    `
    const plan = planEmailTemplateHostableImages(html)
    expect(plan.dataUrls).toHaveLength(1)
    expect(plan.remoteUrls).toEqual(['https://cdn.example.com/hero.jpg'])
    expect(plan.skipped.map((s) => s.reason).sort()).toEqual(['cid', 'relative-or-unsupported'])
    expect(emailTemplateHtmlNeedsImageHosting(html)).toBe(true)
  })

  it('hostUploadedEmailTemplateImages rewrites data URLs via upload callback', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
    const html = `<html><body><img src="${dataUrl}" alt="x"></body></html>`
    const result = await hostUploadedEmailTemplateImages({
      html,
      uploadDataUrl: async () =>
        'https://storage.googleapis.com/custom-marketing-images/custom-marketing/t/library/hosted.png'
    })
    expect(result.hostedCount).toBe(1)
    expect(result.html).toContain('/library/hosted.png')
    expect(result.html).not.toContain('data:image/png')
  })

  it('replaceCustomMarketingImageSrc swaps every occurrence', () => {
    const from = 'data:image/png;base64,aa'
    const html = `<img src="${from}"><img src="${from}">`
    const next = replaceCustomMarketingImageSrc(html, from, 'https://hosted.example/a.png')
    expect(next).toBe(
      '<img src="https://hosted.example/a.png"><img src="https://hosted.example/a.png">'
    )
  })
})
