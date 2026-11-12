import { describe, expect, it } from 'vitest'
import {
  createEmailBlock,
  emailBuilderBodyHtml,
  emailBuilderDocFromHtml,
  parseEmailBuilderDoc
} from './emailBlockBuilder'

describe('email block builder', () => {
  it('round-trips blocks through the saved HTML comment', () => {
    const doc = {
      version: 1 as const,
      blocks: [
        createEmailBlock('heading'),
        { ...createEmailBlock('image'), src: 'https://cdn.example/a.png', alt: 'Week', href: '' }
      ]
    }
    doc.blocks[0] = { ...doc.blocks[0], type: 'heading', text: 'Monday', align: 'center' }
    const html = emailBuilderBodyHtml(doc)
    const parsed = parseEmailBuilderDoc(html)
    expect(parsed?.blocks[0]).toMatchObject({ type: 'heading', text: 'Monday', align: 'center' })
    expect(parsed?.blocks[1]).toMatchObject({ type: 'image', src: 'https://cdn.example/a.png' })
    expect(html).toContain('src="https://cdn.example/a.png"')
    expect(html).toContain('position:absolute')
  })

  it('splits imported HTML into image, heading, text, and button blocks', () => {
    const html = `
      <table><tr>
        <td><img src="https://cdn.example/logo.png" alt="Logo" width="120"></td>
        <td>
          <h1>FORGING A NEW PATH</h1>
          <p>We are partners.</p>
          <a href="https://example.com/apply" style="background:#fff;border-radius:20px;padding:12px 20px;">Apply Now</a>
        </td>
      </tr></table>`
    const doc = emailBuilderDocFromHtml(html)
    expect(doc.blocks.map((block) => block.type)).toEqual(['image', 'heading', 'text', 'button'])
    expect(doc.blocks[0]).toMatchObject({ type: 'image', src: 'https://cdn.example/logo.png' })
    expect(doc.blocks[1]).toMatchObject({ type: 'heading', text: 'FORGING A NEW PATH' })
    expect(doc.blocks[2]).toMatchObject({ type: 'text', text: 'We are partners.' })
    expect(doc.blocks[3]).toMatchObject({ type: 'button', label: 'Apply Now', href: 'https://example.com/apply' })
    expect(doc.blocks.some((block) => block.type === 'html')).toBe(false)
  })
})
