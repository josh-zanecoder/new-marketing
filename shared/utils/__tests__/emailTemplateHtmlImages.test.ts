import { describe, expect, it } from 'vitest'
import {
  emailTemplateHtmlImageLabel,
  listEmailTemplateHtmlImages,
  replaceEmailTemplateHtmlImageSrc
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
})
