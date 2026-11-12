import { describe, expect, it } from 'vitest'
import {
  emailClientSafeImageHtml,
  emailHtmlImageTag,
  emailImageBuilderExportHtml,
  emailPreviewDocument,
  emailPreviewWithBlockMarkers,
  emailTemplateHtmlImageLabel,
  insertEmailTemplateHtmlImage,
  insertEmailTemplateHtmlImageAtPlacement,
  insertEmailTemplateHtmlImageBeforeText,
  listEmailContentBlocks,
  listEmailTemplateHtmlImages,
  moveEmailTemplateHtmlImageBeforeText,
  moveEmailTemplateHtmlImageTo,
  parseInsertableImageUrl,
  removeEmailTemplateHtmlImage,
  replaceEmailTemplateHtmlImageSrc,
  updateEmailTemplateHtmlImageLayout
} from '../emailTemplateHtmlImages'

describe('emailTemplateHtmlImages', () => {
  it('lists img tags in order including data-URL srcs', () => {
    const html = `
      <p>hi</p>
      <img src="data:image/png;base64,aaa" alt="a" />
      <img src='https://cdn.example/b.jpg' width="600">
      <img alt="no-src">
    `
    const imgs = listEmailTemplateHtmlImages(html)
    expect(imgs).toHaveLength(3)
    expect(imgs[0]?.src).toBe('data:image/png;base64,aaa')
    expect(imgs[1]?.src).toBe('https://cdn.example/b.jpg')
    expect(imgs[2]?.src).toBe('')
  })

  it('replaces only the targeted img src and keeps other attributes', () => {
    const html =
      '<div><img src="old-a.png" alt="A" width="100"><img src="old-b.png" alt="B"></div>'
    const next = replaceEmailTemplateHtmlImageSrc(html, 1, 'https://hosted.example/new-b.png')
    expect(next).toContain('src="old-a.png"')
    expect(next).toContain('src="https://hosted.example/new-b.png"')
    expect(next).toContain('alt="B"')
    expect(next).not.toContain('old-b.png')
  })

  it('returns html unchanged for out-of-range index', () => {
    const html = '<img src="x.png">'
    expect(replaceEmailTemplateHtmlImageSrc(html, 3, 'y.png')).toBe(html)
  })

  it('builds friendly labels without dumping base64', () => {
    expect(emailTemplateHtmlImageLabel('data:image/jpeg;base64,xxxx', 0)).toBe(
      'Image 1 · Embedded JPEG'
    )
    expect(emailTemplateHtmlImageLabel('https://cdn.example/path/hero.webp', 2)).toContain(
      'Image 3'
    )
    expect(emailTemplateHtmlImageLabel('https://cdn.example/path/hero.webp', 2)).toContain(
      'hero.webp'
    )
  })

  it('previews a full email document without rewriting it', () => {
    const html = '<!DOCTYPE html><html><head><title>Forge</title></head><body><img src="logo.png"></body></html>'
    expect(emailPreviewDocument(html)).toBe(html)
    expect(emailImageBuilderExportHtml(html)).toBe(html)
    expect(emailPreviewDocument('<img src="logo.png" alt="Logo">')).toContain('<img src="logo.png" alt="Logo">')
  })

  it('inserts an image before the body close and keeps the rest of the email', () => {
    const html = '<html><body><p>Hello</p></body></html>'
    const next = insertEmailTemplateHtmlImage(html, 'https://cdn.example/new.png')
    expect(next).toContain('<p>Hello</p>')
    expect(next).toContain('src="https://cdn.example/new.png"')
    expect(next.indexOf('new.png')).toBeLessThan(next.indexOf('</body>'))
  })

  it('resizes an image with width only and drops inbox positioning', () => {
    const html = '<div><img src="a.png" alt="A" style="position:absolute; left:12px; top:-4px; display:block;"><img src="b.png" alt="B"></div>'
    const next = updateEmailTemplateHtmlImageLayout(html, 0, { width: 180.4, left: 12, top: -4 })
    expect(next).toContain('src="a.png"')
    expect(next).toContain('alt="A"')
    expect(next).toContain('src="b.png"')
    expect(next).toContain('width: 180px')
    expect(next).toContain('height: auto')
    expect(next).toContain('width="180"')
    expect(next).not.toContain('height="')
    expect(next).not.toContain('position')
    expect(next).not.toContain('left:')
    expect(next).not.toContain('top:')
    const side = updateEmailTemplateHtmlImageLayout(html, 0, {
      width: 180,
      height: 90,
      marginLeft: 40,
      marginRight: 12,
      objectPosition: 'right center',
      left: 0,
      top: 0
    })
    expect(side).toContain('width: 180px')
    expect(side).toContain('height: 90px')
    expect(side).toContain('height="90"')
    expect(side).toContain('object-fit: cover')
    expect(side).toContain('object-position: right center')
    expect(side).toContain('margin-left: 40px')
    expect(side).toContain('margin-right: 12px')
    expect(updateEmailTemplateHtmlImageLayout(html, 5, { width: 40, left: 0, top: 0 })).toBe(html)
  })

  it('places and removes images in document order', () => {
    const html = '<html><body><p>Keep this sentence.</p><img src="gone.png"></body></html>'
    const dropped = insertEmailTemplateHtmlImageBeforeText(html, 'https://cdn.example/new.png', 'Keep this sentence.')
    expect(dropped.indexOf('new.png')).toBeLessThan(dropped.indexOf('Keep this sentence.'))
    expect(dropped).not.toContain('position')
    const removed = removeEmailTemplateHtmlImage(html, 0)
    expect(removed).not.toContain('gone.png')
    expect(removed).toContain('Keep this sentence.')
    expect(removeEmailTemplateHtmlImage(html, 9)).toBe(html)
  })

  it('moves an image beside the text under the pointer and strips offsets', () => {
    const html = '<p>Apply online today</p><img src="a.png" width="240" style="position:absolute; left:8px; top:20px;">'
    const next = moveEmailTemplateHtmlImageBeforeText(html, 0, 'Apply online today')
    expect(next.indexOf('a.png')).toBeLessThan(next.indexOf('Apply online today'))
    expect(next).not.toContain('position')
    expect(next).not.toContain('left:')
    expect(next).toContain('width="240"')
  })

  it('keeps a dragged image in the section under the pointer', () => {
    const html = '<html><body><div><p>Hero headline</p></div><div><p>Footer line</p></div><img src="photo.png" width="240"></body></html>'
    const blocks = listEmailContentBlocks(html)
    const footer = blocks.find((block) => html.slice(block.tagEnd, block.tagEnd + 20).includes('Footer'))
    expect(footer).toBeTruthy()
    const moved = moveEmailTemplateHtmlImageTo(html, 0, { kind: 'into-block', index: footer?.index ?? -1 })
    expect(moved.html.indexOf('photo.png')).toBeGreaterThan(moved.html.indexOf('Hero headline'))
    expect(moved.html.indexOf('photo.png')).toBeLessThan(moved.html.indexOf('Footer line'))
    expect(moved.html.indexOf('photo.png')).toBeLessThan(moved.html.lastIndexOf('</div>'))
    expect(moved.index).toBe(0)
    const marked = emailPreviewWithBlockMarkers(html)
    expect(marked).toContain(`data-email-slot="${footer?.index}"`)
    expect(marked).not.toContain('data-email-slot="0" data-email-slot')
    const dropped = insertEmailTemplateHtmlImageAtPlacement(html, 'https://cdn.example/new.png', {
      kind: 'end-of-block',
      index: blocks[0]?.index ?? 0
    })
    expect(dropped.html.indexOf('new.png')).toBeGreaterThan(dropped.html.indexOf('Hero headline'))
    expect(dropped.html.indexOf('new.png')).toBeLessThan(dropped.html.indexOf('Footer line'))
    expect(moveEmailTemplateHtmlImageTo(html, 0, null).html).toBe(html)
    const stayed = moveEmailTemplateHtmlImageBeforeText(html, 0, 'missing phrase')
    expect(stayed.indexOf('photo.png')).toBe(html.indexOf('photo.png'))
    const tables = '<table><tr><td>Hero</td></tr></table><table><tr><td>Footer</td></tr></table><img src="photo.png">'
    const tableBlocks = listEmailContentBlocks(tables)
    const parked = moveEmailTemplateHtmlImageTo(tables, 0, { kind: 'after-block', index: tableBlocks[0]?.index ?? 0 })
    expect(parked.html.indexOf('photo.png')).toBeGreaterThan(parked.html.indexOf('</table>'))
    expect(parked.html.indexOf('photo.png')).toBeLessThan(parked.html.indexOf('Footer'))
  })

  it('strips positioned images before an email is saved', () => {
    const html = '<html><body><img src="a.png" style="position:absolute; left:10px; top:20px; width:240px;"></body></html>'
    const next = emailClientSafeImageHtml(html)
    expect(next).toContain('src="a.png"')
    expect(next).toContain('width: 240px')
    expect(next).not.toContain('position')
    expect(next).not.toContain('left:')
    expect(emailImageBuilderExportHtml(html)).toBe(next)
  })

  it('builds an img tag and accepts only http(s) urls', () => {
    const tag = emailHtmlImageTag('https://cdn.example/a.png?x=1&y=2')
    expect(tag).toContain('src="https://cdn.example/a.png?x=1&amp;y=2"')
    expect(parseInsertableImageUrl(' https://cdn.example/a.png ')).toBe('https://cdn.example/a.png')
    expect(parseInsertableImageUrl('javascript:alert(1)')).toBeNull()
    expect(parseInsertableImageUrl('not a url')).toBeNull()
  })
})
