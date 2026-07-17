import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCustomMarketingGcsObjectPath,
  buildPublicGcsObjectUrl,
  collectCustomMarketingDataImageSrcs,
  extensionForCustomMarketingImageMime,
  htmlContainsCustomMarketingDataImages,
  parseCustomMarketingImageDataUrl,
  replaceCustomMarketingImageSrc,
  sanitizeCustomMarketingGcsPathSegment
} from '../customMarketingHostedImages'

describe('customMarketingHostedImages', () => {
  it('parses allowed data URLs and rejects bad ones', () => {
    const ok = parseCustomMarketingImageDataUrl('data:image/jpeg;base64,YWJj')
    assert.equal(ok?.mime, 'image/jpeg')
    assert.equal(ok?.base64, 'YWJj')
    assert.equal(parseCustomMarketingImageDataUrl('data:text/plain;base64,YWJj'), null)
    assert.equal(parseCustomMarketingImageDataUrl('https://example.com/a.jpg'), null)
  })

  it('collects unique data image srcs from HTML', () => {
    const html =
      '<p><img src="data:image/png;base64,AAA"><img src="data:image/png;base64,AAA">' +
      '<img src="data:image/jpeg;base64,BBB"></p>'
    const srcs = collectCustomMarketingDataImageSrcs(html)
    assert.equal(srcs.length, 2)
    assert.ok(htmlContainsCustomMarketingDataImages(html))
    assert.equal(htmlContainsCustomMarketingDataImages('<p>hi</p>'), false)
  })

  it('replaces data src with hosted URL', () => {
    const from = 'data:image/jpeg;base64,YWJj'
    const html = `<img src="${from}">`
    const next = replaceCustomMarketingImageSrc(
      html,
      from,
      'https://storage.googleapis.com/bucket/custom-marketing/t/l/a.jpg'
    )
    assert.equal(next.includes('data:image'), false)
    assert.ok(next.includes('storage.googleapis.com'))
  })

  it('builds tenant-name + recipient-list GCS folders', () => {
    const path = buildCustomMarketingGcsObjectPath({
      tenantName: 'Acme Corp!',
      recipientListId: '507f1f77bcf86cd799439011',
      fileName: 'photo.jpg'
    })
    assert.equal(path, 'custom-marketing/acme-corp/507f1f77bcf86cd799439011/photo.jpg')
    assert.equal(
      buildCustomMarketingGcsObjectPath({
        tenantName: 'Acme Corp',
        fileName: 'draft.jpg'
      }),
      'custom-marketing/acme-corp/no-list/draft.jpg'
    )
    assert.equal(sanitizeCustomMarketingGcsPathSegment('../evil', 'x'), 'evil')
    assert.equal(extensionForCustomMarketingImageMime('image/png'), 'png')
    assert.equal(
      buildPublicGcsObjectUrl('my-bucket', 'custom-marketing/a/b/c.jpg'),
      'https://storage.googleapis.com/my-bucket/custom-marketing/a/b/c.jpg'
    )
  })
})
