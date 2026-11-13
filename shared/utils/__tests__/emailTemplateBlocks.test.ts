import { describe, expect, it } from 'vitest'
import {
  EMAIL_BLOCK_KINDS,
  countEmailBlockCells,
  duplicateEmailBlock,
  emailTemplateContentWidth,
  emailTemplateStarterHtml,
  insertEmailBlock,
  insertEmailBlockBeside,
  insertEmailBlockIntoCell,
  moveEmailBlock,
  parseEmailBlockLink,
  cleanEmailCustomHtml,
  listEmailBlockLinks,
  readEmailBlockAccent,
  readEmailBlockHtml,
  readEmailBlockVideo,
  readEmailBlockLink,
  removeEmailBlock,
  setEmailColumnSplit,
  updateEmailBlockAccent,
  updateEmailBlockHtml,
  updateEmailBlockLink,
  updateEmailBlockLinkAt,
  updateEmailBlockVideo
} from '../emailTemplateBlocks'
import {
  listEmailArrangeItems,
  listEmailTextRuns,
  readEmailPageColors,
  readEmailSectionBox,
  readEmailTextStyle,
  splitEmailTextRun,
  updateEmailPageColors,
  updateEmailSectionBox,
  updateEmailTextStyle
} from '../emailTemplateSections'

const email = `<html><body><table width="100%"><tr><td align="center">
<table width="600"><tbody>
<tr><td><h1>Welcome</h1></td></tr>
<tr><td><p>Body copy</p></td></tr>
<tr><td><p>Footer</p></td></tr>
</tbody></table>
</td></tr></table></body></html>`

const labels = (html: string) => listEmailArrangeItems(html).map((item) => item.label)
const partOf = (html: string, label: string) => listEmailArrangeItems(html).find((item) => item.label === label)?.part ?? null

describe('email template blocks', () => {
  it('adds a title row right after the selected row', () => {
    const next = insertEmailBlock(email, 'title', partOf(email, 'Welcome'))
    expect(next.html).toContain('<tr data-email-block="title"><td align="center" style="padding:0"><table')
    expect(labels(next.html).filter((label) => ['Welcome', 'Title', 'Body copy', 'Footer'].includes(label)))
      .toEqual(['Welcome', 'Title', 'Body copy', 'Footer'])
    expect(listEmailArrangeItems(next.html)[next.part!]?.label).toBe('Title')
  })

  it('adds a block before the row it was dropped on', () => {
    const next = insertEmailBlock(email, 'button', partOf(email, 'Body copy'), undefined, 'before')
    expect(next.html.indexOf('data-email-block="button"')).toBeLessThan(next.html.indexOf('Body copy'))
    expect(next.html.indexOf('data-email-block="button"')).toBeGreaterThan(next.html.indexOf('Welcome'))
    expect(listEmailArrangeItems(next.html)[next.part!]?.label).toBe('Button')
  })

  it('adds to the end of the content column when nothing is selected', () => {
    const next = insertEmailBlock(email, 'text', null)
    const footerAt = next.html.indexOf('Footer')
    const addedAt = next.html.indexOf('data-email-block="text"')
    expect(addedAt).toBeGreaterThan(footerAt)
    expect(addedAt).toBeLessThan(next.html.indexOf('</tbody>'))
    expect(next.part).not.toBeNull()
  })

  it('uses a table, not a bare row, next to non-row blocks', () => {
    const html = '<div><p>One</p><p>Two</p></div>'
    const next = insertEmailBlock(html, 'divider', partOf(html, 'One'))
    expect(next.html).toContain('<p>One</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-block="divider" data-email-box')
    expect(listEmailArrangeItems(next.html)[next.part!]?.label).toBe('Divider')
  })

  it('makes empty spacers, dividers, and sections selectable', () => {
    let html = insertEmailBlock(email, 'spacer', partOf(email, 'Welcome')).html
    html = insertEmailBlock(html, 'divider', partOf(html, 'Spacer')).html
    html = insertEmailBlock(html, 'sect50', partOf(html, 'Divider')).html
    expect(labels(html)).toEqual(expect.arrayContaining(['Spacer', 'Divider', '2 Columns']))
  })

  it('builds every block kind with one-word placeholders', () => {
    for (const kind of EMAIL_BLOCK_KINDS) {
      const next = insertEmailBlock(email, kind, partOf(email, 'Body copy'), 'https://cdn.example.com/a.png')
      expect(next.html).not.toBe(email)
      expect(next.part).not.toBeNull()
      const added = listEmailTextRuns(next.html).map((run) => run.text).filter((text) => !['Welcome', 'Body copy', 'Footer'].includes(text))
      for (const text of added) expect(text.split(/\s+/).length).toBe(1)
      if (kind === 'image') expect(next.html).toContain('src="https://cdn.example.com/a.png"')
    }
  })

  it('lays out empty section cells like GrapesJS', () => {
    const cells = (kind: 'sect100' | 'sect50' | 'sect30' | 'sect37') => insertEmailBlock(email, kind, 0).html.match(/<td data-email-cell width="([\d.]+)%"/g)
    expect(cells('sect100')).toHaveLength(1)
    expect(cells('sect50')).toHaveLength(2)
    expect(cells('sect30')).toHaveLength(3)
    expect(cells('sect37')?.join(' ')).toMatch(/width="30%"[\s\S]*width="70%"/)
  })

  it('drops a block into an empty section cell', () => {
    const withSection = insertEmailBlock(email, 'sect50', partOf(email, 'Welcome')).html
    expect(countEmailBlockCells(withSection)).toBe(2)
    const next = insertEmailBlockIntoCell(withSection, 1, 'button')
    const second = [...next.html.matchAll(/<td data-email-cell[^>]*>/g)][1]?.[0] ?? ''
    expect(second).not.toMatch(/height/)
    expect(next.html.indexOf('data-email-block="button"')).toBeGreaterThan(next.html.indexOf(second))
    expect(listEmailArrangeItems(next.html)[next.part!]?.label).toBe('Button')
    const first = [...next.html.matchAll(/<td data-email-cell[^>]*>/g)][0]?.[0] ?? ''
    expect(first).toContain('height:120px')
    expect(insertEmailBlockIntoCell(withSection, 5, 'text').html).toBe(withSection)
  })

  it('moves a block into a section cell and back out to the column', () => {
    let html = insertEmailBlock(email, 'sect50', partOf(email, 'Welcome')).html
    html = insertEmailBlock(html, 'button', partOf(html, 'Footer')).html
    const into = moveEmailBlock(html, partOf(html, 'Button')!, { cell: 1 })
    expect(into.html).toMatch(/<td data-email-cell width="50%"[^>]*><table data-email-block="button"[^>]*data-email-box/)
    expect(into.html).not.toContain('<tr data-email-block="button">')
    expect(listEmailArrangeItems(into.html)[into.part!]?.label).toBe('Button')
    expect(into.html.match(/<td data-email-cell[^>]*>/g)?.[1]).not.toMatch(/height/)

    const out = moveEmailBlock(into.html, into.part!, { part: partOf(into.html, 'Footer')!, place: 'after' })
    expect(out.html).toContain('<tr data-email-block="button"><td align="center" style="padding:0"><table')
    expect(out.html.indexOf('data-email-block="button"')).toBeGreaterThan(out.html.indexOf('Footer'))
    expect(out.html.match(/<td data-email-cell[^>]*>/g)?.every((tag) => tag.includes('height="120"'))).toBe(true)
    expect(listEmailArrangeItems(out.html)[out.part!]?.label).toBe('Button')
  })

  it('moves a block to another spot in the same column', () => {
    const html = insertEmailBlock(email, 'divider', partOf(email, 'Footer')).html
    const moved = moveEmailBlock(html, partOf(html, 'Divider')!, { part: partOf(html, 'Welcome')!, place: 'before' })
    expect(moved.html.indexOf('data-email-block="divider"')).toBeLessThan(moved.html.indexOf('Welcome'))
    expect(listEmailArrangeItems(moved.html)[moved.part!]?.label).toBe('Divider')
  })

  const widths = (html: string) => [...html.matchAll(/<td data-email-cell width="([\d.]+)%"/g)].map((match) => Number(match[1]))
  const partOfKind = (html: string, kind: string) => {
    const at = html.search(new RegExp(`<\\w+ data-email-block="${kind}"`))
    return listEmailArrangeItems(html).find((item) => item.start === at)?.part ?? null
  }

  it('puts blocks side by side, grows the row, then turns it back into full-width blocks', () => {
    let html = insertEmailBlock(email, 'button', partOf(email, 'Footer')).html
    html = insertEmailBlock(html, 'text', partOf(html, 'Button')).html
    html = insertEmailBlock(html, 'divider', partOf(html, 'Text')).html
    const sized = updateEmailSectionBox(html, partOf(html, 'Button')!, { width: 280, marginLeft: 0 })

    const two = moveEmailBlock(sized, partOf(sized, 'Text')!, { part: partOf(sized, 'Button')!, side: 'right' })
    expect(two.html).toMatch(/<tr data-email-block="row">[\s\S]*data-email-block="button"[\s\S]*data-email-block="text"/)
    expect(widths(two.html)).toEqual([50, 50])
    expect(two.html).not.toContain('width:280px')
    expect(listEmailArrangeItems(two.html)[two.part!]?.label).toBe('Text')

    const three = moveEmailBlock(two.html, partOfKind(two.html, 'divider')!, { part: two.part!, side: 'left' })
    expect(widths(three.html)).toEqual([33.3333, 33.3333, 33.3333])
    expect(three.html).toMatch(/data-email-block="button"[\s\S]*data-email-block="divider"[\s\S]*data-email-block="text"/)
    expect(three.html.match(/data-email-block="row"/g)).toHaveLength(1)

    const back = moveEmailBlock(three.html, partOfKind(three.html, 'divider')!, { part: partOf(three.html, 'Footer')!, place: 'after' })
    expect(widths(back.html)).toEqual([50, 50])
    expect(back.html).toContain('<tr data-email-block="divider">')

    const wide = moveEmailBlock(back.html, partOf(back.html, 'Text')!, { part: partOf(back.html, 'Footer')!, place: 'after' })
    expect(wide.html).not.toContain('data-email-block="row"')
    expect(wide.html).toContain('<tr data-email-block="button"><td align="center" style="padding:0"><table')
    expect(wide.html).toContain('<tr data-email-block="text">')
    expect(wide.html).not.toContain('data-email-mark')
  })

  it('changes a button fill and corners, and a divider color and thickness', () => {
    let html = insertEmailBlock(email, 'button', partOf(email, 'Footer')).html
    html = insertEmailBlock(html, 'divider', partOf(html, 'Button')).html
    const button = partOf(html, 'Button')!
    const divider = partOf(html, 'Divider')!
    expect(readEmailBlockAccent(html, button)).toEqual({ kind: 'button', color: '#111111', size: 6 })
    expect(readEmailBlockAccent(html, partOf(html, 'Footer')!)).toBeNull()

    html = updateEmailBlockAccent(html, button, { color: '#ffffff', size: 24 })
    expect(html).toContain('bgcolor="#ffffff" style="border-radius:24px;background-color:#ffffff"')
    expect(readEmailBlockAccent(html, button)).toEqual({ kind: 'button', color: '#ffffff', size: 24 })

    html = updateEmailBlockAccent(html, divider, { color: '#f97316', size: 3 })
    expect(html).toContain('border-top:3px solid #f97316')
    expect(readEmailBlockAccent(html, divider)).toEqual({ kind: 'divider', color: '#f97316', size: 3 })
    expect(updateEmailBlockAccent(html, divider, { color: 'red;x' })).toBe(html)
  })

  it('splits a title so its two halves can be colored differently', () => {
    const html = insertEmailBlock(email, 'title', partOf(email, 'Footer')).html
    const runs = listEmailTextRuns(html)
    const title = runs.findIndex((run) => run.text === 'Title')
    const named = html.replace('>Title</h2>', '>Built for brokers. Focused &amp; fast</h2>')
    const split = splitEmailTextRun(named, title, 'Built for brokers. '.length)!
    expect(split.html).toContain('>Built for brokers. <span>Focused &amp; fast</span></h2>')
    expect(listEmailTextRuns(split.html).slice(title, title + 2).map((run) => run.text)).toEqual(['Built for brokers.', 'Focused & fast'])
    const colored = updateEmailTextStyle(split.html, split.index, { color: '#f97316' })
    expect(readEmailTextStyle(colored, split.index).color).toBe('#f97316')
    expect(readEmailTextStyle(colored, title).color).not.toBe('#f97316')
    expect(splitEmailTextRun(named, title, 0)).toBeNull()
  })

  it('adds a new block on the left of another', () => {
    const html = insertEmailBlock(email, 'button', partOf(email, 'Footer')).html
    const next = insertEmailBlockBeside(html, 'title', partOf(html, 'Button')!, 'left')
    expect(next.html).toMatch(/data-email-block="row"[\s\S]*data-email-block="title"[\s\S]*data-email-block="button"/)
    expect(listEmailArrangeItems(next.html)[next.part!]?.label).toBe('Title')
    expect(next.html).not.toContain('data-email-mark')
  })

  it('adds a column to a layout section instead of nesting it', () => {
    const html = insertEmailBlock(email, 'sect50', partOf(email, 'Footer')).html
    const next = insertEmailBlockBeside(html, 'text', partOf(html, '2 Columns')!, 'right')
    expect(widths(next.html)).toEqual([33.3333, 33.3333, 33.3333])
    expect(next.html).toContain('data-email-block="row"')
    expect(next.html).not.toContain('data-email-block="sect50"')
  })

  it('removes the emptied column when a block in a row is deleted', () => {
    let html = insertEmailBlock(email, 'button', partOf(email, 'Footer')).html
    html = insertEmailBlockBeside(html, 'text', partOf(html, 'Button')!, 'right').html
    const removed = removeEmailBlock(html, partOf(html, 'Text')!)
    expect(removed).not.toContain('data-email-block="row"')
    expect(removed).toContain('<tr data-email-block="button">')
  })

  it('moves the divider between two columns', () => {
    let html = insertEmailBlock(email, 'button', partOf(email, 'Footer')).html
    html = insertEmailBlockBeside(html, 'text', partOf(html, 'Button')!, 'right').html
    const split = setEmailColumnSplit(html, 0, 70)
    expect(widths(split)).toEqual([70, 30])
    expect(split).toMatch(/width="70%"[^>]*style="width:70%/)
    expect(widths(setEmailColumnSplit(html, 0, 99))).toEqual([90, 10])
    expect(setEmailColumnSplit(html, 1, 50)).toBe(html)
  })

  it('will not put template rows it did not add into columns', () => {
    const next = insertEmailBlockBeside(email, 'title', partOf(email, 'Body copy')!, 'right')
    expect(next.html).toBe(email)
    expect(next.part).toBeNull()
    const html = insertEmailBlock(email, 'text', partOf(email, 'Footer')).html
    expect(moveEmailBlock(html, partOf(html, 'Welcome')!, { part: partOf(html, 'Text')!, side: 'left' }).html).toBe(html)
  })

  it('refuses moves that would break the email', () => {
    const html = insertEmailBlock(email, 'sect50', partOf(email, 'Welcome')).html
    const section = partOf(html, '2 Columns')!
    expect(moveEmailBlock(html, section, { cell: 0 }).html).toBe(html)
    expect(moveEmailBlock(html, partOf(html, 'Welcome')!, { cell: 0 }).html).toBe(html)
    expect(moveEmailBlock(html, section, { part: section, place: 'after' }).html).toBe(html)
  })

  it('resizes an added row on its own box, not the whole email', () => {
    const added = insertEmailBlock(email, 'text', partOf(email, 'Welcome'))
    const sized = updateEmailSectionBox(added.html, added.part!, { width: 300, marginLeft: 20, paddingTop: 30 })
    expect(sized).toContain('<table width="600">')
    expect(sized).toMatch(/data-email-box[^>]*width:300px/)
    expect(sized).toMatch(/<td style="[^"]*padding-top:30px/)
    expect(sized).not.toMatch(/<p[^>]*width:300px/)
    const box = readEmailSectionBox(sized, added.part!)
    expect(box.width).toBe(300)
    expect(box.paddingTop).toBe(30)
  })

  it('changes the whole email background and the content card color', () => {
    const starter = emailTemplateStarterHtml()
    expect(readEmailPageColors(starter)).toEqual({ background: '#f1f5f9', content: '' })
    const painted = updateEmailPageColors(starter, { background: '#112233', content: '#fefefe' })
    expect(readEmailPageColors(painted)).toEqual({ background: '#112233', content: '#fefefe' })
    expect(painted).toMatch(/<body style="[^"]*background-color:#112233[^"]*" bgcolor="#112233">/)
    expect(painted).toMatch(/<table [^>]*bgcolor="#112233"/)
    expect(painted).toMatch(/<table [^>]*width="600"[^>]*bgcolor="#fefefe"/)
    expect(painted).not.toContain('#f1f5f9')
    const cleared = updateEmailPageColors(painted, { content: '' })
    expect(readEmailPageColors(cleared).content).toBe('')
    expect(updateEmailPageColors(starter, { background: 'not-a-color' })).toBe(starter)
  })

  it('paints the background of an existing template without touching background images', () => {
    const html = `<html><body style="margin:0"><table width="100%" style="background:url(x.png) #eeeeee"><tr><td>
<table width="640" style="background:#ffffff"><tr><td><p>Hi</p></td></tr></table>
</td></tr></table></body></html>`
    const next = updateEmailPageColors(html, { background: '#000000', content: '#fafafa' })
    expect(next).toContain('<body style="margin:0;background-color:#000000" bgcolor="#000000">')
    expect(next).toContain('url(x.png)')
    expect(next).toMatch(/<table width="640" style="background-color:#fafafa" bgcolor="#fafafa">/)
    expect(readEmailPageColors(next).content).toBe('#fafafa')
  })

  it('needs a photo link before adding an image block', () => {
    expect(insertEmailBlock(email, 'image', 0).html).toBe(email)
  })

  it('duplicates and removes a block', () => {
    const part = partOf(email, 'Body copy')!
    const copied = duplicateEmailBlock(email, part)
    expect(copied.html.split('Body copy').length - 1).toBe(2)
    expect(copied.part).toBe(part + 1)
    const removed = removeEmailBlock(copied.html, copied.part!)
    expect(removed).toBe(email)
    expect(removeEmailBlock(email, partOf(email, 'Footer')!)).not.toContain('Footer')
  })

  it('reads and changes a button link', () => {
    const added = insertEmailBlock(email, 'button', partOf(email, 'Welcome'))
    expect(readEmailBlockLink(added.html, added.part!)).toBe('https://example.com')
    const linked = updateEmailBlockLink(added.html, added.part!, 'https://mortdash.com/apply?a=1&b=2')
    expect(linked).toContain('href="https://mortdash.com/apply?a=1&amp;b=2"')
    expect(readEmailBlockLink(linked, added.part!)).toBe('https://mortdash.com/apply?a=1&b=2')
    expect(updateEmailBlockLink(linked, added.part!, 'javascript:alert(1)')).toBe(linked)
    expect(readEmailBlockLink(email, 0)).toBeNull()
    const twoLinks = '<div><p><a href="https://a.com">A</a> <a href="https://b.com">B</a></p><p>Next</p></div>'
    expect(readEmailBlockLink(twoLinks, 0)).toBeNull()
    expect(updateEmailBlockLink(twoLinks, 0, 'https://c.com')).toBe(twoLinks)
  })

  it('starts a blank email with an empty 600px column', () => {
    const starter = emailTemplateStarterHtml()
    expect(labels(starter)).toEqual([])
    expect(listEmailTextRuns(starter)).toEqual([])
    expect(countEmailBlockCells(starter)).toBe(0)
    const added = insertEmailBlock(starter, 'divider', null)
    expect(added.html).toMatch(/<tbody data-email-column>\s*<tr data-email-block="divider">/)
    expect(added.html.indexOf('data-email-block="divider"')).toBeLessThan(added.html.indexOf('</tbody>'))
    expect(labels(added.html)).toEqual(['Divider'])
    expect(added.part).toBe(0)
  })

  it('keeps the column usable after every block is deleted', () => {
    let html = insertEmailBlock(emailTemplateStarterHtml(), 'sect100', null).html
    html = removeEmailBlock(html, 0)
    expect(labels(html)).toEqual([])
    const added = insertEmailBlock(html, 'title', null)
    expect(added.html).toMatch(/<tbody data-email-column>\s*<tr data-email-block="title">[\s\S]*<\/tr><\/tbody>/)
    expect(labels(added.html)).toEqual(['Title'])
    expect(added.part).toBe(0)
  })

  it('still ignores a lone block in a template it did not add', () => {
    expect(labels('<table><tr><td><p>Only line</p></td></tr></table>')).toEqual([])
  })

  it('reads the email content width from fixed-width tables', () => {
    expect(emailTemplateContentWidth(emailTemplateStarterHtml())).toBe(600)
    expect(emailTemplateContentWidth('<table width="100%"><tr><td><table style="width:640px"></table></td></tr></table>')).toBe(640)
    expect(emailTemplateContentWidth('<table width="2000"></table><table width="50"></table>')).toBe(600)
    expect(emailTemplateContentWidth('<p>No tables</p>')).toBe(600)
  })

  it('accepts web, email, phone, and merge-tag links only', () => {
    expect(parseEmailBlockLink('https://a.com')).toBe('https://a.com')
    expect(parseEmailBlockLink('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(parseEmailBlockLink('tel:+15551234')).toBe('tel:+15551234')
    expect(parseEmailBlockLink('{{unsubscribe_url}}')).toBe('{{unsubscribe_url}}')
    expect(parseEmailBlockLink('javascript:alert(1)')).toBeNull()
    expect(parseEmailBlockLink('ftp://a.com')).toBeNull()
    expect(parseEmailBlockLink('')).toBeNull()
  })
})

describe('beefree-style blocks', () => {
  const added = (kind: Parameters<typeof insertEmailBlock>[1]) => {
    const next = insertEmailBlock(email, kind, partOf(email, 'Welcome'))
    return { html: next.html, part: next.part! }
  }

  it('builds a four-column row and a wide + narrow row', () => {
    expect(countEmailBlockCells(added('sect25').html, added('sect25').part)).toBe(4)
    const wide = added('sect73')
    expect(wide.html).toMatch(/width="70%"[\s\S]*width="30%"/)
  })

  it('lists and edits every link in a social or menu block', () => {
    const social = added('social')
    const links = listEmailBlockLinks(social.html, social.part)
    expect(links.map((link) => link.label)).toEqual(['Facebook', 'X', 'Instagram', 'LinkedIn'])
    const next = updateEmailBlockLinkAt(social.html, social.part, 2, 'https://instagram.com/acme')
    expect(listEmailBlockLinks(next, social.part)[2]?.href).toBe('https://instagram.com/acme')
    expect(listEmailBlockLinks(next, social.part)[0]?.href).toBe('https://facebook.com')
    const menu = added('menu')
    expect(listEmailBlockLinks(menu.html, menu.part).map((link) => link.label)).toEqual(['Home', 'About', 'Contact'])
  })

  it('replaces custom HTML without scripts or handlers', () => {
    const block = added('html')
    expect(readEmailBlockHtml(block.html, block.part)).toContain('HTML')
    const next = updateEmailBlockHtml(block.html, block.part, '<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><a href="javascript:x">y</a>')!
    expect(readEmailBlockHtml(next, block.part)).toBe('<p>Hi <b>there</b></p><a href="#">y</a>')
    expect(updateEmailBlockHtml(block.html, block.part, '<div><p>open')).toBeNull()
    expect(cleanEmailCustomHtml('<td>x</tr>')).toBeNull()
    expect(cleanEmailCustomHtml('Line<br>two<img src="a.png">')).toBe('Line<br>two<img src="a.png">')
  })

  it('links a video and shows the YouTube thumbnail', () => {
    const block = added('video')
    const next = updateEmailBlockVideo(block.html, block.part, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')!
    expect(next).toContain('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(readEmailBlockVideo(next, block.part)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3')
    const vimeo = updateEmailBlockVideo(next, block.part, 'https://vimeo.com/1')!
    expect(vimeo).not.toContain('img.youtube.com')
    expect(updateEmailBlockVideo(block.html, block.part, 'mailto:a@b.co')).toBeNull()
  })

  it('adds list and table blocks', () => {
    expect(added('list').html).toMatch(/<ul[^>]*><li>Item<\/li>/)
    const table = added('table')
    expect(table.html).toContain('>Header</th>')
    expect(labels(table.html).filter((label) => /Header|Cell/.test(label))).toHaveLength(1)
  })
})
