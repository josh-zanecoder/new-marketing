import { describe, expect, it } from 'vitest'
import {
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_CELL_ATTR
} from '../../constants/emailImageRow'
import {
  emailImageRowHtml,
  isEmailImageRowOpenTag,
  updateEmailImageRowLayout,
  wrapAdjacentImagesInRow
} from '../emailImageRow'

describe('emailImageRow', () => {
  it('builds a 2-column email-safe image row', () => {
    const html = emailImageRowHtml({
      count: 2,
      srcs: ['https://cdn.example/a.png', 'https://cdn.example/b.png'],
      spacingPx: 12,
      align: 'center',
      valign: 'top'
    })
    expect(html).toContain(`${EMAIL_IMAGE_ROW_ATTR}="2"`)
    expect(html).toContain('data-email-image-spacing="12"')
    expect(html).toContain('data-email-image-align="center"')
    expect(html).toContain('data-email-image-valign="top"')
    expect(html).toContain('role="presentation"')
    expect(html).toContain('table-layout:fixed')
    expect(html.match(new RegExp(EMAIL_IMAGE_ROW_CELL_ATTR, 'g'))).toHaveLength(2)
    expect(html).toContain('width="50%"')
    expect(html).toContain('padding:12px')
    expect(html).toContain('src="https://cdn.example/a.png"')
    expect(html).toContain('src="https://cdn.example/b.png"')
    expect(html).toContain('display:block')
    expect(html).not.toContain('position:')
    expect(html).not.toContain('float:')
  })

  it('builds 3 and 4 column rows with equal widths', () => {
    const three = emailImageRowHtml({ count: 3 })
    expect(three).toContain(`${EMAIL_IMAGE_ROW_ATTR}="3"`)
    expect(three.match(/width="33.3333%"/g)).toHaveLength(3)

    const four = emailImageRowHtml({ count: 4, srcs: ['https://cdn.example/x.png'] })
    expect(four).toContain(`${EMAIL_IMAGE_ROW_ATTR}="4"`)
    expect(four.match(/width="25%"/g)).toHaveLength(4)
    expect(four).toContain('https://cdn.example/x.png')
  })

  it('updates spacing and alignment on every image-row cell', () => {
    const html = emailImageRowHtml({ count: 2, spacingPx: 8, align: 'left', valign: 'top' })
    const next = updateEmailImageRowLayout(html, {
      spacingPx: 20,
      align: 'right',
      valign: 'middle'
    })
    expect(next).toContain('padding:20px')
    expect(next).toContain('align="right"')
    expect(next).toContain('text-align:right')
    expect(next).toContain('valign="middle"')
    expect(next).toContain('vertical-align:middle')
    expect(updateEmailImageRowLayout('<p>no row</p>', { spacingPx: 10 })).toBe('<p>no row</p>')
  })

  it('wraps adjacent image tags into one row', () => {
    const wrapped = wrapAdjacentImagesInRow([
      '<img src="https://cdn.example/left.png" width="200">',
      '<img src="https://cdn.example/right.png" width="200">'
    ], { spacingPx: 10, align: 'center' })
    expect(wrapped).toContain(`${EMAIL_IMAGE_ROW_ATTR}="2"`)
    expect(wrapped).toContain('https://cdn.example/left.png')
    expect(wrapped).toContain('https://cdn.example/right.png')
    expect(wrapAdjacentImagesInRow(['<img src="only.png">'])).toBeNull()
  })

  it('recognizes image-row open tags', () => {
    expect(isEmailImageRowOpenTag(`<table ${EMAIL_IMAGE_ROW_ATTR}="2">`)).toBe(true)
    expect(isEmailImageRowOpenTag('<table role="presentation">')).toBe(false)
  })
})
