import { describe, expect, it } from 'vitest'
import { EMAIL_IMAGE_ROW_ATTR } from '../../constants/emailImageRow'
import { emailImageRowHtml } from '../emailImageRow'
import { listEmailImageRowSrcs, swapEmailImageRowCells } from '../emailImageRowSwap'

describe('emailImageRowSwap', () => {
  it('reorders images within the same row without dropping markup', () => {
    const html = emailImageRowHtml({
      count: 3,
      srcs: [
        'https://cdn.example/a.png',
        'https://cdn.example/b.png',
        'https://cdn.example/c.png'
      ]
    })
    expect(listEmailImageRowSrcs(html)).toEqual([
      'https://cdn.example/a.png',
      'https://cdn.example/b.png',
      'https://cdn.example/c.png'
    ])

    const swapped = swapEmailImageRowCells(html, 0, 2)
    expect(listEmailImageRowSrcs(swapped)).toEqual([
      'https://cdn.example/c.png',
      'https://cdn.example/b.png',
      'https://cdn.example/a.png'
    ])
    expect(swapped).toContain(`${EMAIL_IMAGE_ROW_ATTR}="3"`)
    expect(swapped).toContain('data-email-image-spacing=')
    expect(swapEmailImageRowCells(html, 0, 0)).toBe(html)
  })
})
