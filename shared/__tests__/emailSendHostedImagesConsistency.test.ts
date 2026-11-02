import { describe, expect, it } from 'vitest'
import { applyEmailPreviewText } from '../emailPreviewText'
import {
  buildPublicGcsObjectUrl,
  CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
  buildCustomMarketingGcsObjectPath,
  htmlContainsCustomMarketingDataImages
} from '../customMarketingHostedImages'
import { mergeMustacheTemplate } from '../utils/emailTemplateMerge'
import { ensureEmailTemplateUnsubscribe } from '../utils/ensureEmailTemplateUnsubscribe'
import {
  listEmailTemplateHtmlImages,
  replaceEmailTemplateHtmlImageSrc
} from '../utils/emailTemplateHtmlImages'

/** Same shape the template editor inserts when picking from Images. */
function hostedImgSnippet(url: string): string {
  const src = url.replace(/"/g, '&quot;')
  return `<img src="${src}" alt="" width="600" style="display:block;max-width:100%;height:auto;border:0;" />`
}

function extractImgSrcs(html: string): string[] {
  return listEmailTemplateHtmlImages(html).map((i) => i.src)
}

function isSendSafeHostedSrc(src: string): boolean {
  const s = String(src ?? '').trim()
  if (!s) return false
  if (/^data:/i.test(s)) return false
  return /^https:\/\//i.test(s)
}

/**
 * Mirrors send-test / campaign send HTML prep:
 * merge tokens → preview text → (templates already have unsubscribe on save).
 */
function prepareHtmlForSend(templateHtml: string, mergeRoot: Record<string, unknown>, preview = '') {
  const merged = mergeMustacheTemplate(templateHtml, mergeRoot)
  return applyEmailPreviewText(merged, preview)
}

describe('email send consistency — Images library hosted HTTPS imgs', () => {
  const libraryUrl = buildPublicGcsObjectUrl(
    'custom-marketing-images',
    buildCustomMarketingGcsObjectPath({
      tenantName: 'Demo Tenant',
      recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
      fileName: '1730000000-hero.jpg'
    })
  )

  const heroUrl =
    'https://storage.googleapis.com/custom-marketing-images/custom-marketing/demo-tenant/library/hero.webp'
  const logoUrl =
    'https://storage.googleapis.com/custom-marketing-images/custom-marketing/demo-tenant/email-templates/logo.png'

  it('builds library object paths under …/library/ with public https URLs', () => {
    expect(libraryUrl.startsWith('https://storage.googleapis.com/')).toBe(true)
    expect(libraryUrl).toContain('/library/')
    expect(isSendSafeHostedSrc(libraryUrl)).toBe(true)
  })

  it('keeps every hosted img src intact through merge + preview (send path)', () => {
    const template = `<!DOCTYPE html><html><body>
      <p>Hi {{recipient.firstName}},</p>
      ${hostedImgSnippet(heroUrl)}
      <p>From {{user.firstName}}</p>
      <img src="${logoUrl}" alt="Logo" width="120" />
      <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
    </body></html>`

    const prepared = prepareHtmlForSend(
      template,
      {
        recipient: { firstName: 'Alex' },
        user: { firstName: 'Sam' },
        unsubscribe_url: 'https://example.com/unsub?t=1'
      },
      'Your monthly update'
    )

    const srcs = extractImgSrcs(prepared)
    expect(srcs).toEqual([heroUrl, logoUrl])
    expect(srcs.every(isSendSafeHostedSrc)).toBe(true)
    expect(htmlContainsCustomMarketingDataImages(prepared)).toBe(false)
    expect(prepared).toContain('Hi Alex,')
    expect(prepared).toContain('From Sam')
    expect(prepared).not.toContain('{{recipient.firstName}}')
  })

  it('unsubscribe ensure on save does not strip or rewrite hosted imgs', () => {
    const html = `<!DOCTYPE html><html><body>
      ${hostedImgSnippet(libraryUrl)}
      <p>News</p>
    </body></html>`

    const { html: next } = ensureEmailTemplateUnsubscribe(html)
    const srcs = extractImgSrcs(next)
    expect(srcs).toEqual([libraryUrl])
    expect(srcs.every(isSendSafeHostedSrc)).toBe(true)
    expect(htmlContainsCustomMarketingDataImages(next)).toBe(false)
  })

  it('Replace from Images library only swaps the target img and stays send-safe', () => {
    const before = `<div>
      <img src="${heroUrl}" alt="A" width="600">
      <img src="data:image/png;base64,AAAA" alt="B">
    </div>`

    const after = replaceEmailTemplateHtmlImageSrc(before, 1, logoUrl)
    const srcs = extractImgSrcs(after)
    expect(srcs[0]).toBe(heroUrl)
    expect(srcs[1]).toBe(logoUrl)
    expect(srcs.every(isSendSafeHostedSrc)).toBe(true)
    expect(htmlContainsCustomMarketingDataImages(after)).toBe(false)
  })

  it('flags base64 embeds as NOT send-safe (Gmail strips them)', () => {
    const broken = `<p><img src="data:image/jpeg;base64,/9j/4AAQ" alt="x"></p>`
    expect(htmlContainsCustomMarketingDataImages(broken)).toBe(true)
    expect(extractImgSrcs(broken).every(isSendSafeHostedSrc)).toBe(false)
  })

  it('multi-image newsletter HTML survives send prep without dropping imgs', () => {
    const urls = [heroUrl, logoUrl, libraryUrl]
    const template = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
      <table role="presentation"><tr><td>
        ${urls.map((u) => hostedImgSnippet(u)).join('\n')}
        <p>Hello {{recipient.firstName}}</p>
      </td></tr></table>
    </body></html>`

    const prepared = prepareHtmlForSend(
      ensureEmailTemplateUnsubscribe(template).html,
      { recipient: { firstName: 'Jordan' } },
      'Preview line'
    )

    expect(extractImgSrcs(prepared)).toEqual(urls)
    expect(htmlContainsCustomMarketingDataImages(prepared)).toBe(false)
    expect(prepared.match(/<img\b/gi)?.length).toBe(3)
  })
})
