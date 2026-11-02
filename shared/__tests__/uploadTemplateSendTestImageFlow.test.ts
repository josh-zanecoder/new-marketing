import { describe, expect, it } from 'vitest'
import { applyEmailPreviewText } from '../emailPreviewText'
import {
  buildCustomMarketingGcsObjectPath,
  buildPublicGcsObjectUrl,
  CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
  htmlContainsCustomMarketingDataImages
} from '../customMarketingHostedImages'
import { mergeMustacheTemplate } from '../utils/emailTemplateMerge'
import { ensureEmailTemplateUnsubscribe } from '../utils/ensureEmailTemplateUnsubscribe'
import { normalizeUploadedEmailHtml } from '../utils/uploadedEmailHtml'
import {
  listEmailTemplateHtmlImages,
  replaceEmailTemplateHtmlImageSrc
} from '../utils/emailTemplateHtmlImages'

/**
 * End-to-end *logic* of:
 * Images upload → Insert/Replace in template → Save template → Send test HTML prep.
 * (No live GCS / ZC Mail — proves hosted HTTPS imgs are not broken along the path.)
 */

function hostedImgSnippet(url: string): string {
  const src = url.replace(/"/g, '&quot;')
  return `<img src="${src}" alt="" width="600" style="display:block;max-width:100%;height:auto;border:0;" />`
}

function extractImgSrcs(html: string): string[] {
  return listEmailTemplateHtmlImages(html).map((i) => i.src)
}

function isSendSafeHostedSrc(src: string): boolean {
  const s = String(src ?? '').trim()
  return Boolean(s) && /^https:\/\//i.test(s) && !/^data:/i.test(s)
}

/** Same prep as send-test-email.service after templateHtml is loaded. */
function prepareSendTestHtml(
  templateHtml: string,
  mergeRoot: Record<string, unknown>,
  previewText = ''
): string {
  return applyEmailPreviewText(mergeMustacheTemplate(templateHtml, mergeRoot), previewText)
}

describe('flow: upload image → create template → send test', () => {
  const uploadedUrl = buildPublicGcsObjectUrl(
    'custom-marketing-images',
    buildCustomMarketingGcsObjectPath({
      tenantName: 'Demo Tenant',
      recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
      fileName: `${Date.now()}-newsletter-hero.jpg`
    })
  )

  it('1) Images upload produces a library HTTPS link (send-safe)', () => {
    expect(uploadedUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(uploadedUrl).toContain('/library/')
    expect(isSendSafeHostedSrc(uploadedUrl)).toBe(true)
  })

  it('2) Insert image into template HTML uses that hosted link', () => {
    let html = `<!DOCTYPE html><html><body>
      <h1>Hello {{recipient.firstName}}</h1>
      <p>Body copy</p>
    </body></html>`

    // Mirrors HostedImagePickerModal → onHostedImagePicked insert path
    const snippet = hostedImgSnippet(uploadedUrl)
    html = html.replace('</body>', `${snippet}</body>`)

    const srcs = extractImgSrcs(html)
    expect(srcs).toEqual([uploadedUrl])
    expect(htmlContainsCustomMarketingDataImages(html)).toBe(false)
  })

  it('3) Save template (normalize + unsubscribe) keeps hosted imgs intact', () => {
    const drafted = `<!DOCTYPE html><html><body>
      <p>Hi {{recipient.firstName}}</p>
      ${hostedImgSnippet(uploadedUrl)}
      <img src="https://storage.googleapis.com/custom-marketing-images/custom-marketing/demo-tenant/email-templates/logo.png" alt="Logo" />
    </body></html>`

    const normalized = normalizeUploadedEmailHtml(drafted)
    const saved = ensureEmailTemplateUnsubscribe(normalized).html
    const srcs = extractImgSrcs(saved)

    expect(srcs).toHaveLength(2)
    expect(srcs[0]).toBe(uploadedUrl)
    expect(srcs.every(isSendSafeHostedSrc)).toBe(true)
    expect(htmlContainsCustomMarketingDataImages(saved)).toBe(false)
  })

  it('4) Send test HTML prep preserves imgs and merges tokens', () => {
    const savedTemplate = ensureEmailTemplateUnsubscribe(
      normalizeUploadedEmailHtml(`<!DOCTYPE html><html><body>
        <p>Hi {{recipient.firstName}},</p>
        ${hostedImgSnippet(uploadedUrl)}
        <p>From {{user.firstName}}</p>
        <a href="{{unsubscribe_url}}">Unsubscribe</a>
      </body></html>`)
    ).html

    // Draft / campaign test-email path uses templateHtml as stored
    const outboundHtml = prepareSendTestHtml(
      savedTemplate,
      {
        recipient: { firstName: 'Alex' },
        user: { firstName: 'Sam' },
        unsubscribe_url: 'https://marketing.example.com/unsubscribe?t=abc'
      },
      'Monthly newsletter preview'
    )

    expect(outboundHtml).toContain('Hi Alex,')
    expect(outboundHtml).toContain('From Sam')
    expect(outboundHtml).toContain('https://marketing.example.com/unsubscribe?t=abc')
    expect(extractImgSrcs(outboundHtml)).toEqual([uploadedUrl])
    expect(htmlContainsCustomMarketingDataImages(outboundHtml)).toBe(false)
    expect(outboundHtml).toContain('data-email-preview-text="1"')
    // Provider payload would use this string as htmlContent — still HTTPS
    expect(outboundHtml).toContain(`src="${uploadedUrl}"`)
  })

  it('5) Replace-then-send still uses only hosted HTTPS srcs', () => {
    const base64 = 'data:image/png;base64,iVBORw0KGgo='
    const before = `<div>${hostedImgSnippet(base64)}<p>{{recipient.firstName}}</p></div>`
    const afterInsert = replaceEmailTemplateHtmlImageSrc(before, 0, uploadedUrl)
    const saved = ensureEmailTemplateUnsubscribe(
      normalizeUploadedEmailHtml(
        `<!DOCTYPE html><html><body>${afterInsert}</body></html>`
      )
    ).html
    const outbound = prepareSendTestHtml(saved, { recipient: { firstName: 'Pat' } }, '')

    expect(extractImgSrcs(outbound)).toEqual([uploadedUrl])
    expect(htmlContainsCustomMarketingDataImages(outbound)).toBe(false)
    expect(outbound).toContain('Pat')
  })

  it('6) full chain smoke: upload URL → insert → save → send test payload', () => {
    // Simulate API upload response
    const uploadResponse = {
      ok: true as const,
      url: uploadedUrl,
      objectPath: buildCustomMarketingGcsObjectPath({
        tenantName: 'Demo Tenant',
        recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
        fileName: 'hero.jpg'
      }),
      id: 'path'
    }

    // Create template body as editor would after Insert image
    let htmlContent = '<!DOCTYPE html><html><body><p>Welcome</p></body></html>'
    htmlContent = htmlContent.replace(
      '</body>',
      `${hostedImgSnippet(uploadResponse.url)}</body>`
    )

    // Save
    const htmlTemplate = ensureEmailTemplateUnsubscribe(
      normalizeUploadedEmailHtml(htmlContent)
    ).html

    // sendTestEmail({ templateHtml: htmlTemplate, ... }) prep
    const htmlContentOutbound = prepareSendTestHtml(
      htmlTemplate,
      { recipient: { firstName: 'Casey', email: 'casey@example.com' } },
      'Test preview'
    )

    const sendTestPayload = {
      recipient: 'casey@example.com',
      subject: '[Test] Newsletter',
      templateHtml: htmlTemplate,
      htmlContent: htmlContentOutbound
    }

    expect(sendTestPayload.htmlContent).toContain(uploadResponse.url)
    expect(extractImgSrcs(sendTestPayload.htmlContent).every(isSendSafeHostedSrc)).toBe(true)
    expect(htmlContainsCustomMarketingDataImages(sendTestPayload.htmlContent)).toBe(false)
    expect(listEmailTemplateHtmlImages(sendTestPayload.htmlContent)).toHaveLength(1)
  })
})
