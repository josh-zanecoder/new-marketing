import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  emailPreviewWithArrangeMarkers,
  emailPreviewWithTextMarkers,
  listEmailArrangeItems,
  listEmailTextRuns,
  moveEmailArrangeItemBy,
  readEmailSectionBox,
  readEmailTextStyle,
  replaceEmailTextAt,
  replaceEmailTextRun,
  updateEmailSectionBox,
  updateEmailTextStyle
} from '../emailTemplateSections'
import {
  emailClientSafeImageHtml,
  insertEmailTemplateHtmlImageBeforeText,
  listEmailTemplateHtmlImages,
  removeEmailTemplateHtmlImage,
  updateEmailTemplateHtmlImageLayout
} from '../emailTemplateHtmlImages'

/**
 * A saved email a user would open, not a blank canvas.
 * Headings, a long paragraph, a link, two columns, an image, and a button.
 */
const existingTemplate = `<!DOCTYPE html><html><body style="margin:0;background:#0b1f3a">
<table width="600" style="width:600px;background-color:#0b1f3a">
<tr><td style="padding:24px;background-color:#0b1f3a">
<h1 style="margin:0;color:#ffffff;font-size:30px;font-family:Arial,Helvetica,sans-serif;text-align:center"><strong>FORGING</strong></h1>
<h2 style="margin:0;color:#f38b00;font-size:22px">A NEW PATH</h2>
<p style="margin:0;color:#ffffff;font-size:16px;line-height:24px">At Forge Capital Lending, we're not just lenders — we're partners. We forge solutions that empower brokers.</p>
<p style="margin:0"><a href="https://example.com/apply" style="color:#f38b00">Apply Now</a></p>
<img src="https://cdn.example.com/hero.png" alt="Summit" width="560" style="display:block;width:560px;height:auto">
<table><tr>
<td style="padding:12px;background-color:#112233"><p style="margin:0;color:#ffffff"><strong>BROKER FIRST</strong></p><p style="margin:0;color:#cbd5e1">We empower brokers with tools.</p></td>
<td style="padding:12px;background-color:#112233"><p style="margin:0;color:#ffffff"><em>Real people.</em></p></td>
</tr></table>
<p style="margin:0;color:#94a3b8;font-size:12px">&nbsp;</p>
<a href="https://example.com/go" style="background-color:#f38b00;color:#ffffff;padding:12px 20px">Get Approved</a>
</td></tr></table>
</body></html>`

const kept = [
  'https://example.com/apply',
  'https://example.com/go',
  'https://cdn.example.com/hero.png',
  'alt="Summit"',
  'background-color:#0b1f3a',
  'background-color:#112233',
  'line-height:24px',
  'text-align:center'
]

function runIndex(html: string, text: string): number {
  const index = listEmailTextRuns(html).findIndex((run) => run.text === text)
  if (index < 0) throw new Error(`missing run: ${text}`)
  return index
}

function texts(html: string): string[] {
  return listEmailTextRuns(html).map((run) => run.text)
}

describe('existing template editor integrity', () => {
  it('opens the saved email without rewriting it', () => {
    const before = existingTemplate
    emailPreviewWithArrangeMarkers(before)
    emailPreviewWithTextMarkers(before)
    emailClientSafeImageHtml(before)
    expect(before).toBe(existingTemplate)
    expect(texts(before)).toEqual([
      'FORGING',
      'A NEW PATH',
      "At Forge Capital Lending, we're not just lenders — we're partners. We forge solutions that empower brokers.",
      'Apply Now',
      'BROKER FIRST',
      'We empower brokers with tools.',
      'Real people.',
      'Get Approved'
    ])
    expect(listEmailTemplateHtmlImages(before)).toHaveLength(1)
    for (const piece of kept) expect(before).toContain(piece)
  })

  it('does not list a spacer paragraph as editable words', () => {
    expect(texts(existingTemplate).some((text) => text.trim() === '')).toBe(false)
  })

  it('replaces, inserts, and deletes inside one block and leaves every other block', () => {
    const heading = runIndex(existingTemplate, 'FORGING')
    const cases = [
      'PATHWAY',
      'FORGING TODAY',
      'NEW FORGING',
      'FOR GING',
      'FORGE',
      'F',
      'FORGING — wholesale'
    ]
    for (const nextText of cases) {
      const next = replaceEmailTextRun(existingTemplate, heading, nextText)
      expect(texts(next)[heading]).toBe(nextText)
      expect(texts(next).filter((_, index) => index !== heading)).toEqual(
        texts(existingTemplate).filter((_, index) => index !== heading)
      )
      for (const piece of kept) expect(next).toContain(piece)
      expect(next).toContain('<h2')
      expect(next).toContain('</table>')
    }
  })

  it('keeps an edit at the start, middle, and end of a long paragraph', () => {
    const index = runIndex(existingTemplate, texts(existingTemplate)[2]!)
    const original = texts(existingTemplate)[2]!
    const start = replaceEmailTextRun(existingTemplate, index, `Hello. ${original}`)
    const middle = replaceEmailTextRun(existingTemplate, index, original.replace('partners.', 'partners. Extra sentence.'))
    const end = replaceEmailTextRun(existingTemplate, index, `${original} Thank you.`)
    expect(texts(start)[index]?.startsWith('Hello. ')).toBe(true)
    expect(texts(middle)[index]).toContain('Extra sentence.')
    expect(texts(end)[index]?.endsWith('Thank you.')).toBe(true)
    expect(texts(start)[0]).toBe('FORGING')
    expect(texts(middle)).toContain('Apply Now')
    expect(texts(end)).toContain('Get Approved')
  })

  it('clears one block and can put the original words back', () => {
    const index = runIndex(existingTemplate, 'BROKER FIRST')
    const cleared = replaceEmailTextRun(existingTemplate, index, '')
    expect(texts(cleared)).not.toContain('BROKER FIRST')
    expect(texts(cleared)).toContain('We empower brokers with tools.')
    expect(cleared).toContain('https://cdn.example.com/hero.png')
    const restored = replaceEmailTextRun(cleared, runIndex(cleared, 'We empower brokers with tools.') - 1, 'BROKER FIRST')
    expect(texts(restored)).toContain('BROKER FIRST')
    expect(texts(restored)).toContain('Real people.')
  })

  it('stores a typed line break without swallowing the next heading', () => {
    const index = runIndex(existingTemplate, 'FORGING')
    const run = listEmailTextRuns(existingTemplate)[index]!
    const next = replaceEmailTextAt(existingTemplate, run.start, run.end, 'FORGING\nSECOND LINE', false)
    expect(next.html).toContain('FORGING<br>SECOND LINE')
    expect(next.html).toContain('A NEW PATH')
    expect(next.html).toContain('Apply Now')
    expect(texts(next.html)).toContain('SECOND LINE')
    expect(texts(next.html)).toContain('A NEW PATH')
    expect(next.html.indexOf('SECOND LINE')).toBeLessThan(next.html.indexOf('A NEW PATH'))
  })

  it('escapes pasted markup, emoji, and unicode instead of breaking the table', () => {
    const index = runIndex(existingTemplate, 'A NEW PATH')
    const pasted = 'Café naïve 😀 <b>Word</b> & "quotes" • line'
    const next = replaceEmailTextRun(existingTemplate, index, pasted)
    expect(next).toContain('Café naïve 😀 &lt;b&gt;Word&lt;/b&gt; &amp; "quotes" • line')
    expect(next).not.toContain('<b>Word</b>')
    expect(texts(next)).toContain('FORGING')
    expect(texts(next)).toContain('Get Approved')
    expect((next.match(/<table/gi) ?? []).length).toBe((existingTemplate.match(/<table/gi) ?? []).length)
    expect((next.match(/<\/table>/gi) ?? []).length).toBe((existingTemplate.match(/<\/table>/gi) ?? []).length)
  })

  it('turns several pasted lines into breaks and leaves the button link', () => {
    const index = runIndex(existingTemplate, 'We empower brokers with tools.')
    const next = replaceEmailTextRun(existingTemplate, index, 'Line one\n\nLine three')
    expect(next).toContain('Line one<br><br>Line three')
    expect(next).toContain('href="https://example.com/go"')
    expect(next).toContain('>Get Approved<')
    expect(texts(next)).toContain('BROKER FIRST')
    expect(texts(next)).toContain('Real people.')
  })

  it('edits the same block fifty times and still has the rest of the email', () => {
    let html = existingTemplate
    for (let step = 0; step < 50; step += 1) {
      const index = runIndex(html, texts(html)[0]!)
      html = replaceEmailTextRun(html, index, `FORGING ${step}`)
    }
    expect(texts(html)[0]).toBe('FORGING 49')
    expect(texts(html)).toContain('A NEW PATH')
    expect(texts(html)).toContain('Apply Now')
    expect(texts(html)).toContain('Get Approved')
    expect(html).toContain('https://cdn.example.com/hero.png')
    expect(listEmailTemplateHtmlImages(html)).toHaveLength(1)
  })

  it('changes bold, italic, size, color, and font on one block only', () => {
    const index = runIndex(existingTemplate, 'Apply Now')
    const next = updateEmailTextStyle(existingTemplate, index, {
      bold: true,
      italic: true,
      size: 18,
      color: '#112233',
      font: 'georgia'
    })
    expect(readEmailTextStyle(next, index)).toMatchObject({
      bold: true,
      italic: true,
      size: 18,
      color: '#112233',
      font: 'georgia'
    })
    expect(next).toContain('href="https://example.com/apply"')
    expect(readEmailTextStyle(next, runIndex(next, 'FORGING')).color).toBe('#ffffff')
    expect(readEmailTextStyle(next, runIndex(next, 'A NEW PATH')).color).toBe('#f38b00')
    expect(readEmailTextStyle(next, runIndex(next, 'Real people.')).italic).toBe(true)
    expect(next).toContain('font-size:30px')
    expect(next).toContain('line-height:24px')
  })

  it('edits words after a style change and keeps that style on the same block', () => {
    const index = runIndex(existingTemplate, 'BROKER FIRST')
    const styled = updateEmailTextStyle(existingTemplate, index, { color: '#abcdef', size: 20 })
    const edited = replaceEmailTextRun(styled, runIndex(styled, 'BROKER FIRST'), 'BROKER LED')
    expect(texts(edited)).toContain('BROKER LED')
    expect(texts(edited)).not.toContain('BROKER FIRST')
    expect(readEmailTextStyle(edited, runIndex(edited, 'BROKER LED')).color).toBe('#abcdef')
    expect(edited).toContain('We empower brokers with tools.')
    expect(readEmailTextStyle(edited, runIndex(edited, 'We empower brokers with tools.')).color).toBe('#cbd5e1')
  })

  it('does not restyle the neighboring column when one column is bold', () => {
    const left = runIndex(existingTemplate, 'We empower brokers with tools.')
    const next = updateEmailTextStyle(existingTemplate, left, { bold: true })
    expect(readEmailTextStyle(next, runIndex(next, 'We empower brokers with tools.')).bold).toBe(true)
    expect(readEmailTextStyle(next, runIndex(next, 'Real people.')).bold).toBe(false)
    expect(next).toContain('<em>Real people.</em>')
  })

  it('resizes one section and leaves the other column, image, and copy', () => {
    const part = listEmailArrangeItems(existingTemplate).find((item) => item.label.includes('BROKER FIRST'))?.part
    expect(part).toBeTypeOf('number')
    const before = readEmailSectionBox(existingTemplate, part!)
    const next = updateEmailSectionBox(existingTemplate, part!, { width: 240, marginLeft: 12, paddingTop: 20, paddingBottom: 8 })
    expect(readEmailSectionBox(next, part!)).toMatchObject({ width: 240, marginLeft: 12, paddingTop: 20, paddingBottom: 8 })
    expect(before.width).not.toBe(240)
    expect(texts(next)).toEqual(texts(existingTemplate))
    expect(next).toContain('https://cdn.example.com/hero.png')
    expect(next).toContain('width="560"')
    expect(next).toContain('Real people.')
  })

  it('moves one row and keeps every word, image, and link', () => {
    const items = listEmailArrangeItems(existingTemplate)
    const part = items.find((item) => item.kind === 'section')?.part
    expect(part).toBeTypeOf('number')
    const moved = moveEmailArrangeItemBy(existingTemplate, part!, 1)
    expect(texts(moved.html).sort()).toEqual(texts(existingTemplate).sort())
    expect(moved.html).toContain('https://cdn.example.com/hero.png')
    expect(moved.html).toContain('href="https://example.com/apply"')
    expect(moved.html).toContain('href="https://example.com/go"')
    expect((moved.html.match(/<table/gi) ?? []).length).toBe((existingTemplate.match(/<table/gi) ?? []).length)
    expect((moved.html.match(/<\/table>/gi) ?? []).length).toBe((existingTemplate.match(/<\/table>/gi) ?? []).length)
  })

  it('removes the photo and leaves the headings, link, and button', () => {
    const next = removeEmailTemplateHtmlImage(existingTemplate, 0)
    expect(listEmailTemplateHtmlImages(next)).toHaveLength(0)
    expect(next).not.toContain('hero.png')
    expect(texts(next)).toEqual(texts(existingTemplate))
    expect(next).toContain('href="https://example.com/apply"')
    expect(next).toContain('>Get Approved<')
  })

  it('inserts a photo in front of a heading without replacing that heading', () => {
    const next = insertEmailTemplateHtmlImageBeforeText(existingTemplate, 'https://cdn.example.com/extra.png', 'A NEW PATH')
    expect(listEmailTemplateHtmlImages(next)).toHaveLength(2)
    expect(next.indexOf('extra.png')).toBeLessThan(next.indexOf('A NEW PATH'))
    expect(texts(next)).toEqual(texts(existingTemplate))
    expect(next).toContain('https://cdn.example.com/hero.png')
  })

  it('changes one photo width and leaves the other photo address and the copy', () => {
    const withTwo = insertEmailTemplateHtmlImageBeforeText(existingTemplate, 'https://cdn.example.com/extra.png', 'Get Approved')
    const next = updateEmailTemplateHtmlImageLayout(withTwo, 0, { width: 120 })
    expect(next).toContain('width="120"')
    expect(next).toContain('https://cdn.example.com/extra.png')
    expect(next).toContain('https://cdn.example.com/hero.png')
    expect(texts(next)).toContain('FORGING')
    expect(texts(next)).toContain('Get Approved')
  })

  it('refuses a stale range that would cut through a closing tag', () => {
    const run = listEmailTextRuns(existingTemplate)[0]!
    const stale = replaceEmailTextAt(existingTemplate, run.start, run.end + 8, 'BROKEN', true)
    expect(stale.html).toBe(existingTemplate)
  })

  it('refreshes the canvas when a typed edit was held until the box closed', () => {
    const source = readFileSync(resolve(__dirname, '../../../app/components/tenant/EmailTemplateImageBuilder.vue'), 'utf8')
    expect(source).toContain('let previewHeld = false')
    expect(source).toContain('previewHeld = true')
    expect(source).toContain('if (!changed && held)')
    expect(source).toContain('return changed || held')
  })

  it('preview markers do not become part of the saved document', () => {
    const preview = emailPreviewWithTextMarkers(emailPreviewWithArrangeMarkers(existingTemplate))
    expect(preview).toContain('data-email-text="0"')
    expect(existingTemplate).not.toContain('data-email-text')
    expect(existingTemplate).not.toContain('data-email-part')
    expect(texts(preview)).toEqual(texts(existingTemplate))
  })
})
