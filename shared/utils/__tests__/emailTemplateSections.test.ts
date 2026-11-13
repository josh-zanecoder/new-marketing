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

const nestedEmail = `
<table><tr><td>
  <table>
    <tr><td><h1>Hello there</h1><p>Intro line</p></td></tr>
    <tr><td><p>Body copy</p><img src="hero.png" alt="Hero"></td></tr>
    <tr><td><p>Footer line</p></td></tr>
  </table>
</td></tr></table>
`

describe('email template sections', () => {
  it('identifies the inner rows, plus text and images that sit side by side', () => {
    const items = listEmailArrangeItems(nestedEmail)
    const labels = items.map((item) => `${item.kind}:${item.label}`)
    expect(labels).toContain('section:Body copy')
    expect(labels).toContain('section:Footer line')
    expect(labels).toContain('text:Hello there')
    expect(labels).toContain('text:Intro line')
    expect(labels).toContain('text:Body copy')
    expect(labels).toContain('image:Hero')
    expect(labels.filter((label) => label.startsWith('section:'))).toHaveLength(3)
  })

  it('moves a section below the next one and leaves the rest of the email in place', () => {
    const items = listEmailArrangeItems(nestedEmail)
    const hello = items.find((item) => item.kind === 'section' && item.label.startsWith('Hello'))
    expect(hello).toBeTruthy()
    const moved = moveEmailArrangeItemBy(nestedEmail, hello!.part, 1)
    expect(moved.html).not.toBe(nestedEmail)
    const bodyAt = moved.html.indexOf('Body copy')
    const helloAt = moved.html.indexOf('Hello there')
    const footerAt = moved.html.indexOf('Footer line')
    expect(bodyAt).toBeGreaterThan(-1)
    expect(helloAt).toBeGreaterThan(bodyAt)
    expect(footerAt).toBeGreaterThan(helloAt)
    expect(moved.html).toContain('<table>')
    expect(moved.html).toContain('</table>')
  })

  it('moves an image above the text in the same cell', () => {
    const items = listEmailArrangeItems(nestedEmail)
    const image = items.find((item) => item.kind === 'image')
    expect(image).toBeTruthy()
    const moved = moveEmailArrangeItemBy(nestedEmail, image!.part, -1)
    const imageAt = moved.html.indexOf('hero.png')
    const bodyAt = moved.html.indexOf('Body copy')
    expect(imageAt).toBeGreaterThan(-1)
    expect(imageAt).toBeLessThan(bodyAt)
  })

  it('identifies sibling div sections', () => {
    const html = '<body><div><h1>First block</h1></div><div><p>Second block</p></div></body>'
    const items = listEmailArrangeItems(html)
    expect(items.map((item) => item.label)).toEqual(['First block', 'Second block'])
    expect(items.every((item) => item.kind === 'section')).toBe(true)
  })

  it('does not offer a single wrapper as a movable section', () => {
    const html = '<body><div><h1>Only one</h1></div></body>'
    expect(listEmailArrangeItems(html)).toEqual([])
  })

  it('lists the text inside a section and leaves style and spacers out', () => {
    const html = '<style>p{color:red}</style><div><h1>Hello &amp; co</h1><p>&#8202;</p><p>Body copy</p></div>'
    expect(listEmailTextRuns(html).map((run) => run.text)).toEqual(['Hello & co', 'Body copy'])
  })

  it('keeps the space between a phrase and the colored words beside it', () => {
    const html = '<p style="margin:0">BUILT FOR BROKERS. <span style="color:#f38b00">FOCUSED ON BORROWERS.</span></p>'
    const runs = listEmailTextRuns(html)
    expect(runs.map((run) => run.text)).toEqual(['BUILT FOR BROKERS.', 'FOCUSED ON BORROWERS.'])
    expect(html.slice(runs[0]!.start, runs[0]!.end)).toBe('BUILT FOR BROKERS.')
    const edited = replaceEmailTextRun(html, 0, 'BUILT FOR TEAMS.')
    expect(edited).toBe('<p style="margin:0">BUILT FOR TEAMS. <span style="color:#f38b00">FOCUSED ON BORROWERS.</span></p>')
  })

  it('replaces one text run and keeps the surrounding tags', () => {
    const html = '<td><h1>Hello &amp; co</h1><p>Keep me</p></td>'
    expect(replaceEmailTextRun(html, 0, 'Hello & co')).toBe(html)
    const next = replaceEmailTextRun(html, 0, 'Hi <there>')
    expect(next).toBe('<td><h1>Hi &lt;there&gt;</h1><p>Keep me</p></td>')
    expect(listEmailTextRuns(next).map((run) => run.text)).toEqual(['Hi <there>', 'Keep me'])
  })

  it('updates the same text while it is still being typed', () => {
    const html = '<p>Hello</p><p>Tail</p>'
    const first = listEmailTextRuns(html)[0]
    expect(first).toBeTruthy()
    const spaced = replaceEmailTextAt(html, first!.start, first!.end, 'Hello ')
    expect(spaced.html).toBe('<p>Hello </p><p>Tail</p>')
    const next = replaceEmailTextAt(spaced.html, first!.start, spaced.end, 'Hello w')
    expect(next.html).toBe('<p>Hello w</p><p>Tail</p>')
  })

  it('marks the same text order in the preview as in the saved email', () => {
    const html = '<div><p>Alpha</p></div><div><p>Beta &amp; co</p></div>'
    const source = listEmailTextRuns(html).map((run) => run.text)
    const marked = emailPreviewWithArrangeMarkers(html)
    expect(listEmailTextRuns(marked).map((run) => run.text)).toEqual(source)
    const preview = emailPreviewWithTextMarkers(marked)
    expect(preview).toContain('data-email-text="0"')
    expect(preview).toContain('data-email-text="1"')
    expect(preview.indexOf('Alpha')).toBeLessThan(preview.indexOf('Beta'))
  })

  it('sets size, color, bold, and font on the words and keeps the other styles', () => {
    const html = '<p style="margin:0">Hello</p><p>Tail</p>'
    const sized = updateEmailTextStyle(html, 0, { size: 24, color: '#112233', bold: true, font: 'georgia' })
    expect(sized).toBe('<p style="margin:0;font-family:Georgia, Times, serif;font-size:24px;color:#112233;font-weight:700">Hello</p><p>Tail</p>')
    expect(readEmailTextStyle(sized, 0)).toMatchObject({ size: 24, color: '#112233', bold: true, font: 'georgia' })
    expect(readEmailTextStyle(sized, 1).size).toBeNull()
    expect(listEmailTextRuns(sized).map((run) => run.text)).toEqual(['Hello', 'Tail'])
  })

  it('styles one phrase inside a paragraph and updates that same phrase again', () => {
    const html = '<p>Hello <b>there</b></p>'
    const colored = updateEmailTextStyle(html, 0, { color: '#ff0000' })
    expect(colored).toBe('<p><span style="color:#ff0000">Hello</span> <b>there</b></p>')
    const grown = updateEmailTextStyle(colored, 0, { size: 18 })
    expect(grown).toBe('<p><span style="color:#ff0000;font-size:18px">Hello</span> <b>there</b></p>')
    expect(readEmailTextStyle(html, 1).bold).toBe(true)
  })

  it('puts a heading width on the text and keeps its words whole', () => {
    const html = '<div><table><tr><td><h1><span style="word-break:break-word">A NEW PATH</span></h1></td></tr></table><table><tr><td><p>Next</p></td></tr></table></div>'
    const part = listEmailArrangeItems(html).find((item) => item.label.includes('A NEW PATH'))?.part
    expect(part).toBeTypeOf('number')
    const next = updateEmailSectionBox(html, part!, { width: 220 })
    expect(next).toContain('<h1 style="word-break:normal;width:220px">')
    expect(next).toContain('<span style="word-break:normal">A NEW PATH</span>')
    expect(next).not.toContain('break-word')
    expect(next).toContain('>Next<')
  })

  it('colors a section and makes that section taller', () => {
    const html = '<table><tbody><tr><td style="padding:10px">One</td></tr><tr><td>Two</td></tr></tbody></table>'
    const part = listEmailArrangeItems(html).find((item) => item.label.includes('One'))?.part
    expect(part).toBeTypeOf('number')
    const colored = updateEmailSectionBox(html, part!, { background: '#112233' })
    expect(colored).toContain('background-color:#112233')
    expect(colored).toContain('bgcolor="#112233"')
    expect(colored).toContain('padding:10px')
    expect(colored).toContain('>Two<')
    const taller = updateEmailSectionBox(colored, part!, { paddingBottom: 40 })
    expect(taller).toContain('background-color:#112233')
    expect(taller).toContain('padding-top:10px')
    expect(taller).toContain('padding-bottom:40px')
    expect(taller).not.toContain('padding:10px')
    expect(readEmailSectionBox(taller, part!)).toMatchObject({ background: '#112233', paddingBottom: 40, paddingTop: 10 })
  })

  it('turns a typed newline into a line break', () => {
    const html = '<h1>FORGING</h1>'
    const run = listEmailTextRuns(html)[0]
    const next = replaceEmailTextAt(html, run!.start, run!.end, 'FORGING\n', false)
    expect(next.html).toBe('<h1>FORGING<br></h1>')
  })

  it('leaves a styled heading alone when the saved range covers its closing tag', () => {
    const html = '<h1><span style="color:#ff6a00">A NEW PATH</span></h1><h1>FORGING</h1>'
    const run = listEmailTextRuns(html)[0]
    expect(run?.text).toBe('A NEW PATH')
    const stale = replaceEmailTextAt(html, (run?.start ?? 0) + 1, (run?.end ?? 0) + 1, 'A NEW PATH', true)
    expect(stale.html).toBe(html)
    expect(listEmailArrangeItems(stale.html).map((item) => item.label)).toEqual(['A NEW PATH', 'FORGING'])
  })

  it('narrows a section from the side and keeps the other row', () => {
    const html = '<table width="560" style="width:560px"><tr><td>One</td></tr><tr><td>Two</td></tr></table>'
    const part = listEmailArrangeItems(html).find((item) => item.label === 'One')?.part
    expect(part).toBeTypeOf('number')
    const next = updateEmailSectionBox(html, part!, { width: 400, marginLeft: 16 })
    expect(next).toContain('width="400"')
    expect(next).toContain('width:400px')
    expect(next).toContain('margin-left:16px')
    expect(next).toContain('margin-right:0')
    expect(next).toContain('align="left"')
    expect(next).toContain('>Two<')
    expect(readEmailSectionBox(next, part!)).toMatchObject({ width: 400, marginLeft: 16 })
  })

  it('moves a centered section to the right', () => {
    const html = '<div><table align="center" style="width:200px;margin:0 auto"><tr><td>One</td></tr></table><table><tr><td>Two</td></tr></table></div>'
    const part = listEmailArrangeItems(html).find((item) => item.label === 'One')?.part
    expect(part).toBeTypeOf('number')
    const next = updateEmailSectionBox(html, part!, { width: 200, marginLeft: 80 })
    expect(next).toContain('align="left"')
    expect(next).toContain('margin-left:80px')
    expect(next).toContain('margin-right:0')
    expect(next).not.toContain('margin:0 auto')
    expect(next).toContain('>Two<')
    expect(readEmailSectionBox(next, part!)).toMatchObject({ width: 200, marginLeft: 80 })
  })

  it('sets a block width without adding a table width attribute', () => {
    const html = '<div>Alpha</div><div>Beta</div>'
    const next = updateEmailSectionBox(html, 0, { width: 240 })
    expect(next.startsWith('<div style="width:240px">Alpha</div>')).toBe(true)
    expect(next).not.toContain('width="240"')
    expect(next).toContain('<div>Beta</div>')
  })

  it('colors a block without adding a table cell color', () => {
    const html = '<div>Alpha</div><div>Beta</div>'
    const part = listEmailArrangeItems(html).find((item) => item.label === 'Alpha')?.part ?? 0
    const colored = updateEmailSectionBox(html, part, { background: '#fff' })
    expect(colored.startsWith('<div style="background-color:#ffffff">Alpha</div>')).toBe(true)
    expect(colored).not.toContain('bgcolor')
    expect(colored).toContain('<div>Beta</div>')
  })

  it('makes one line italic and can turn that italic off', () => {
    const html = '<p style="margin:0">Hello</p><p><em>Tail</em></p>'
    const slanted = updateEmailTextStyle(html, 0, { italic: true })
    expect(slanted).toBe('<p style="margin:0;font-style:italic">Hello</p><p><em>Tail</em></p>')
    expect(readEmailTextStyle(slanted, 0).italic).toBe(true)
    expect(readEmailTextStyle(html, 1).italic).toBe(true)
    expect(updateEmailTextStyle(slanted, 0, { italic: false })).toBe('<p style="margin:0;font-style:normal">Hello</p><p><em>Tail</em></p>')
  })

  it('turns a heading back to regular weight', () => {
    const html = '<h1 style="color:#abc">Grow</h1>'
    expect(readEmailTextStyle(html, 0)).toMatchObject({ bold: true, color: '#aabbcc' })
    expect(updateEmailTextStyle(html, 0, { bold: false })).toBe('<h1 style="color:#abc;font-weight:400">Grow</h1>')
  })

  it('puts line height and alignment on the paragraph, and spacing and underline on the words', () => {
    const html = '<p style="margin:0"><span style="color:#ff6a00">Hello</span> world</p><p>Tail</p>'
    const index = listEmailTextRuns(html).findIndex((run) => run.text === 'Hello')
    const next = updateEmailTextStyle(html, index, { lineHeight: 28, align: 'center', letterSpacing: 2, decoration: 'underline' })
    expect(next).toBe('<p style="margin:0;line-height:28px;text-align:center" align="center"><span style="color:#ff6a00;letter-spacing:2px;text-decoration:underline">Hello</span> world</p><p>Tail</p>')
    expect(readEmailTextStyle(next, index)).toMatchObject({ lineHeight: 28, align: 'center', letterSpacing: 2, decoration: 'underline' })
    expect(readEmailTextStyle(next, listEmailTextRuns(next).findIndex((run) => run.text === 'Tail'))).toMatchObject({ lineHeight: null, align: '', decoration: 'none' })
  })

  it('reads underline and strike tags, and ignores a zero line height', () => {
    const html = '<p style="line-height:0px"><u>Under</u> <s>Gone</s></p>'
    const runs = listEmailTextRuns(html)
    expect(readEmailTextStyle(html, runs.findIndex((run) => run.text === 'Under'))).toMatchObject({ decoration: 'underline', lineHeight: null })
    expect(readEmailTextStyle(html, runs.findIndex((run) => run.text === 'Gone')).decoration).toBe('line-through')
    expect(updateEmailTextStyle(html, 0, { lineHeight: 0 })).toBe(html)
  })

  it('adds a rounded border to a block and removes it again', () => {
    const html = '<table><tr><td style="padding:10px">One</td></tr><tr><td>Two</td></tr></table>'
    const part = listEmailArrangeItems(html).find((item) => item.label === 'One')?.part
    expect(part).toBeTypeOf('number')
    const bordered = updateEmailSectionBox(html, part!, { borderWidth: 2, borderColor: '#123456', borderRadius: 8 })
    expect(bordered).toContain('border-radius:8px')
    expect(bordered).toContain('border:2px solid #123456')
    expect(bordered).toContain('<td>Two</td>')
    expect(readEmailSectionBox(bordered, part!)).toMatchObject({ borderWidth: 2, borderStyle: 'solid', borderColor: '#123456', borderRadius: 8 })
    const dashed = updateEmailSectionBox(bordered, part!, { borderStyle: 'dashed' })
    expect(dashed).toContain('border:2px dashed #123456')
    const cleared = updateEmailSectionBox(dashed, part!, { borderWidth: 0, borderRadius: 0 })
    expect(cleared).toBe(html)
  })

  it('reads a border written as separate properties', () => {
    const html = '<div style="border-width:3px;border-style:dotted;border-color:rgb(255, 0, 0)">Alpha</div><div>Beta</div>'
    expect(readEmailSectionBox(html, 0)).toMatchObject({ borderWidth: 3, borderStyle: 'dotted', borderColor: '#ff0000' })
    expect(readEmailSectionBox('<div style="border-width:3px">Alpha</div><div>Beta</div>', 0).borderWidth).toBe(0)
  })

  it('marks preview sections without changing the saved tags order', () => {
    const html = '<div><p>Alpha</p></div><div><p>Beta</p></div>'
    const marked = emailPreviewWithArrangeMarkers(html)
    expect(marked).toContain('data-email-part="0"')
    expect(marked).toContain('data-email-part="1"')
    expect(marked.indexOf('Alpha')).toBeLessThan(marked.indexOf('Beta'))
  })
})
