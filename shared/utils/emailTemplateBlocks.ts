import { emailHtmlImageTag } from './emailTemplateHtmlImages'
import {
  emailArrangeGroupInnerEnd,
  findEmailElementAt,
  listEmailArrangeItems,
  type EmailElement
} from './emailTemplateSections'

export const EMAIL_BLOCK_KINDS = [
  'sect100',
  'sect50',
  'sect30',
  'sect25',
  'sect37',
  'sect73',
  'title',
  'text',
  'text-sect',
  'list',
  'button',
  'image',
  'table',
  'quote',
  'link',
  'divider',
  'spacer',
  'social',
  'html',
  'video',
  'menu'
] as const
export type EmailBlockKind = (typeof EMAIL_BLOCK_KINDS)[number]

/** What the Add panel offers. Rows hold columns; content goes into a row's columns. */
export const EMAIL_BLOCK_OPTIONS: { kind: EmailBlockKind; label: string; group: 'Layout' | 'Content' }[] = [
  { kind: 'sect100', label: '1 Column', group: 'Layout' },
  { kind: 'sect50', label: '2 Columns', group: 'Layout' },
  { kind: 'sect30', label: '3 Columns', group: 'Layout' },
  { kind: 'sect25', label: '4 Columns', group: 'Layout' },
  { kind: 'sect37', label: 'Narrow + Wide', group: 'Layout' },
  { kind: 'sect73', label: 'Wide + Narrow', group: 'Layout' },
  { kind: 'title', label: 'Title', group: 'Content' },
  { kind: 'text', label: 'Paragraph', group: 'Content' },
  { kind: 'list', label: 'List', group: 'Content' },
  { kind: 'image', label: 'Image', group: 'Content' },
  { kind: 'button', label: 'Button', group: 'Content' },
  { kind: 'table', label: 'Table', group: 'Content' },
  { kind: 'divider', label: 'Divider', group: 'Content' },
  { kind: 'spacer', label: 'Spacer', group: 'Content' },
  { kind: 'social', label: 'Social', group: 'Content' },
  { kind: 'html', label: 'HTML', group: 'Content' },
  { kind: 'video', label: 'Video', group: 'Content' },
  { kind: 'menu', label: 'Menu', group: 'Content' }
]

const FONT = 'Arial, Helvetica, sans-serif'
const TABLE_ATTRS = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
const ROW_PARENTS = new Set(['table', 'tbody', 'thead', 'tfoot'])
const EMPTY_CELL_HEIGHT = 120

const SECTION_COLUMNS: Partial<Record<EmailBlockKind, number[]>> = {
  sect100: [100],
  sect50: [50, 50],
  sect30: [33.3333, 33.3333, 33.3333],
  sect25: [25, 25, 25, 25],
  sect37: [30, 70],
  sect73: [70, 30]
}

const SOCIAL_LINKS = [
  { name: 'Facebook', mark: 'f', color: '#1877f2', href: 'https://facebook.com' },
  { name: 'X', mark: 'X', color: '#000000', href: 'https://x.com' },
  { name: 'Instagram', mark: 'IG', color: '#e1306c', href: 'https://instagram.com' },
  { name: 'LinkedIn', mark: 'in', color: '#0a66c2', href: 'https://linkedin.com' }
]

const MENU_LINKS = ['Home', 'About', 'Contact']

const listHtml = () =>
  `<ul style="margin:0;padding:0 0 0 22px;font-family:${FONT};font-size:16px;line-height:24px;color:#333333"><li>Item</li><li>Item</li><li>Item</li></ul>`

const tableHtml = () => {
  const head = `<th align="left" style="border:1px solid #cbd5e1;background-color:#f1f5f9;padding:8px;font-weight:700">Header</th>`
  const cell = `<td style="border:1px solid #cbd5e1;padding:8px">Cell</td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-email-whole style="border-collapse:collapse;font-family:${FONT};font-size:14px;line-height:20px;color:#333333"><tr>${head}${head}</tr><tr>${cell}${cell}</tr><tr>${cell}${cell}</tr></table>`
}

const socialHtml = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>${SOCIAL_LINKS.map((link) =>
    `<td style="padding:0 4px"><a href="${link.href}" title="${link.name}" target="_blank" style="display:inline-block;width:32px;height:32px;border-radius:16px;background-color:${link.color};font-family:${FONT};font-size:13px;line-height:32px;font-weight:700;color:#ffffff;text-align:center;text-decoration:none">${link.mark}</a></td>`
  ).join('')}</tr></table>`

const menuHtml = () =>
  `<p style="margin:0;text-align:center;font-family:${FONT};font-size:15px;line-height:22px">${MENU_LINKS.map((label) =>
    `<a href="https://example.com" title="${label}" target="_blank" style="display:inline-block;padding:0 12px;color:#111111;font-weight:700;text-decoration:none">${label}</a>`
  ).join('')}</p>`

const VIDEO_PLACEHOLDER_HREF = 'https://www.youtube.com/'

function videoInner(href: string, youtubeId: string | null): string {
  const safe = escapeAttr(href)
  if (youtubeId) {
    return `<a href="${safe}" target="_blank" style="display:block;text-decoration:none"><img src="https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg" alt="Play video" width="552" style="display:block;width:552px;max-width:100%;height:auto;border:0;margin:0 auto" /></a>`
      + `<p style="margin:8px 0 0;text-align:center;font-family:${FONT};font-size:14px;line-height:20px"><a href="${safe}" target="_blank" style="color:#2563eb;text-decoration:none">&#9654; Watch video</a></p>`
  }
  return `<a href="${safe}" target="_blank" style="display:block;text-decoration:none"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" height="240" bgcolor="#111827" style="height:240px;background-color:#111827;font-family:${FONT};font-size:48px;line-height:48px;color:#ffffff">&#9654;</td></tr></table></a>`
}

function escapeAttr(value: string): string {
  return value.replace(/&(?!amp;)/g, '&amp;').replace(/"/g, '&quot;')
}

const titleHtml = () =>
  `<h2 style="margin:0;font-family:${FONT};font-size:28px;line-height:34px;font-weight:700;color:#111111">Title</h2>`

const textHtml = (margin = '0') =>
  `<p style="margin:${margin};font-family:${FONT};font-size:16px;line-height:24px;color:#333333">Text</p>`

const buttonHtml = () =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr><td bgcolor="#111111" style="border-radius:6px;background-color:#111111"><a href="https://example.com" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none">Button</a></td></tr></table>`

function emptyCell(percent: number): string {
  return `<td data-email-cell width="${percent}%" valign="top" height="${EMPTY_CELL_HEIGHT}" style="width:${percent}%;height:${EMPTY_CELL_HEIGHT}px;padding:8px;vertical-align:top"></td>`
}

/** The inside of a block's box: one or more cells. */
function blockCells(kind: EmailBlockKind, imageUrl?: string): string | null {
  const columns = SECTION_COLUMNS[kind]
  if (columns) return columns.map(emptyCell).join('')
  const cell = (inner: string, padding: string) => `<td style="padding:${padding}">${inner}</td>`
  switch (kind) {
    case 'title':
      return cell(titleHtml(), '16px 24px 8px')
    case 'text':
      return cell(textHtml(), '8px 24px')
    case 'text-sect':
      return cell(`${titleHtml()}${textHtml('8px 0 0')}`, '16px 24px')
    case 'button':
      return cell(buttonHtml(), '16px 24px')
    case 'image':
      if (!imageUrl) return null
      return cell(emailHtmlImageTag(imageUrl, { width: 552 }).replace('display:block;', 'display:block;margin:0 auto;'), '16px 24px')
    case 'quote':
      return cell(
        `<p style="margin:0;padding:4px 0 4px 16px;border-left:4px solid #cbd5e1;font-family:${FONT};font-size:18px;line-height:26px;font-style:italic;color:#475569">Quote</p>`,
        '16px 24px'
      )
    case 'link':
      return cell(
        `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:24px"><a href="https://example.com" target="_blank" style="color:#2563eb;text-decoration:underline">Link</a></p>`,
        '8px 24px'
      )
    case 'divider':
      return cell(
        `<table ${TABLE_ATTRS}><tr><td style="border-top:1px solid #e2e8f0;font-size:0;line-height:0">&nbsp;</td></tr></table>`,
        '16px 24px'
      )
    case 'spacer':
      return '<td height="32" style="height:32px;font-size:0;line-height:0">&nbsp;</td>'
    case 'list':
      return cell(listHtml(), '8px 24px')
    case 'table':
      return cell(tableHtml(), '16px 24px')
    case 'social':
      return cell(socialHtml(), '16px 24px')
    case 'menu':
      return cell(menuHtml(), '12px 24px')
    case 'html':
      return `<td data-email-html style="padding:8px 24px"><p style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;color:#333333">HTML</p></td>`
    case 'video':
      return `<td data-email-video style="padding:16px 24px">${videoInner(VIDEO_PLACEHOLDER_HREF, null)}</td>`
    default:
      return null
  }
}

/**
 * Email-safe markup for one new block. Every block owns a `data-email-box` table so it can be
 * resized on its own. Rows are used when the neighbours are table rows.
 */
export function emailBlockHtml(kind: EmailBlockKind, asRow: boolean, imageUrl?: string): string | null {
  const cells = blockCells(kind, imageUrl)
  if (!cells) return null
  if (asRow) {
    return `<tr data-email-block="${kind}"><td align="center" style="padding:0"><table ${TABLE_ATTRS} data-email-box style="width:100%"><tr>${cells}</tr></table></td></tr>`
  }
  return `<table ${TABLE_ATTRS} data-email-block="${kind}" data-email-box style="width:100%"><tr>${cells}</tr></table>`
}

export const EMAIL_CONTENT_WIDTH_DEFAULT = 600

/** The email's content column width in px, read from fixed-width tables. Falls back to 600. */
export function emailTemplateContentWidth(html: string): number {
  let widest = 0
  for (const match of html.matchAll(/<table\b[^>]*>/gi)) {
    const tag = match[0]
    const attr = /\bwidth\s*=\s*["']?(\d{3,4})(?:px)?["']?(?=[\s>/])/i.exec(tag)?.[1]
    const style = /(?:^|[;"'\s])width\s*:\s*(\d{3,4})px/i.exec(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag)?.[2] ?? '')?.[1]
    for (const raw of [attr, style]) {
      const px = Number(raw)
      if (px >= 320 && px <= 900 && px > widest) widest = px
    }
  }
  return widest || EMAIL_CONTENT_WIDTH_DEFAULT
}

/** A blank email: an empty 600px column to drop blocks into. */
export function emailTemplateStarterHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9">
<table ${TABLE_ATTRS} bgcolor="#f1f5f9" style="background-color:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">
<tbody data-email-column>
</tbody>
</table>
</td></tr></table>
</body></html>`
}

function parentTag(group: string): string {
  return group.slice(group.indexOf(':') + 1)
}

/** The starter's content column, so blocks still land inside it after every block is deleted. */
function markedColumn(html: string): { at: number; asRow: boolean } | null {
  const open = /<(\w+)\b[^>]*\bdata-email-column\b[^>]*>/i.exec(html)
  if (!open?.[1]) return null
  const at = emailArrangeGroupInnerEnd(html, `p${open.index}:${open[1].toLowerCase()}`)
  return at == null ? null : { at, asRow: ROW_PARENTS.has(open[1].toLowerCase()) }
}

function bodyInsertPoint(html: string): number {
  const close = /<\/body\s*>/i.exec(html)
  return close ? close.index : html.length
}

export type EmailBlockEdit = { html: string; part: number | null }

function partAt(html: string, start: number): number | null {
  return listEmailArrangeItems(html).find((item) => item.start === start)?.part ?? null
}

/** The last block in the largest group of sibling blocks, which is usually the email's content column. */
function mainColumnEnd(html: string) {
  const groups = new Map<string, ReturnType<typeof listEmailArrangeItems>>()
  for (const item of listEmailArrangeItems(html)) {
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }
  let best: ReturnType<typeof listEmailArrangeItems> = []
  for (const list of groups.values()) {
    if (list.length > best.length) best = list
  }
  return best[best.length - 1]
}

/** Add a block next to `part`, or at the end of the email's content column. */
export function insertEmailBlock(
  html: string,
  kind: EmailBlockKind,
  part: number | null,
  imageUrl?: string,
  place: 'before' | 'after' = 'after'
): EmailBlockEdit {
  const items = listEmailArrangeItems(html)
  const anchor = part == null ? mainColumnEnd(html) : items[part]
  const emptyColumn = anchor ? null : markedColumn(html)
  const columnEnd = part == null && anchor ? emailArrangeGroupInnerEnd(html, anchor.group) : null
  const at = columnEnd
    ?? (anchor ? (place === 'before' ? anchor.start : anchor.end) : emptyColumn?.at ?? bodyInsertPoint(html))
  const asRow = anchor ? ROW_PARENTS.has(parentTag(anchor.group)) : emptyColumn?.asRow ?? false
  const block = emailBlockHtml(kind, asRow, imageUrl)
  if (!block) return { html, part }
  const next = `${html.slice(0, at)}${block}${html.slice(at)}`
  return { html: next, part: partAt(next, at) }
}

const CELL_OPEN_RE = /<td\b[^>]*\bdata-email-cell\b[^>]*>/gi

/** Number of section cells blocks can be dropped into, in document order. */
export function countEmailBlockCells(html: string): number {
  return [...html.matchAll(CELL_OPEN_RE)].length
}

function freeCellTag(openTag: string): string {
  return openTag
    .replace(/\sheight\s*=\s*["']?\d+["']?/i, '')
    .replace(/([;"'\s])height\s*:\s*\d+px;?/i, '$1')
}

const EMPTY_CELL_RE = /(<td\b[^>]*\bdata-email-cell\b[^>]*>)(\s*)(<\/td>)/gi

/** Give emptied section cells their drop-zone height back. Returns how far `mark` shifted. */
function restoreEmptyCells(html: string, mark: number): { html: string; mark: number } {
  let shift = 0
  const next = html.replace(EMPTY_CELL_RE, (whole, open: string, _space: string, close: string, offset: number) => {
    if (/\bheight\s*[=:]/i.test(open.replace(/line-height/gi, ''))) return whole
    const sized = open
      .replace(/>$/, ` height="${EMPTY_CELL_HEIGHT}">`)
      .replace(/\bstyle\s*=\s*"/i, `style="height:${EMPTY_CELL_HEIGHT}px;`)
    const replaced = `${sized}${close}`
    if (offset < mark) shift += replaced.length - whole.length
    return replaced
  })
  return { html: next, mark: mark + shift }
}

/** Add a block at the end of the `cell`-th section cell. The cell drops its empty-state height. */
export function insertEmailBlockIntoCell(html: string, cell: number, kind: EmailBlockKind, imageUrl?: string): EmailBlockEdit {
  const open = [...html.matchAll(CELL_OPEN_RE)][cell]
  const block = emailBlockHtml(kind, false, imageUrl)
  if (!open || !block) return { html, part: null }
  const end = emailArrangeGroupInnerEnd(html, `p${open.index}:td`)
  if (end == null) return { html, part: null }
  const freed = freeCellTag(open[0])
  const at = end + freed.length - open[0].length
  const next = `${html.slice(0, open.index)}${freed}${html.slice(open.index + open[0].length, end)}${block}${html.slice(end)}`
  return { html: next, part: partAt(next, at) }
}

export type EmailBlockTarget =
  | { part: number; place: 'before' | 'after' }
  | { part: number; side: 'left' | 'right' }
  | { cell: number }

/** Let a box that was resized fill its new column again. */
function fullWidthBox(content: string): string {
  return content.replace(/^(<table\b[^>]*>)/i, (open) => {
    if (!/\bdata-email-box\b/i.test(open)) return open
    return open
      .replace(/\swidth\s*=\s*["']?[\d.]+%?["']?/i, ' width="100%"')
      .replace(/\salign\s*=\s*["']?\w+["']?/i, '')
      .replace(/(style\s*=\s*")([^"]*)"/i, (_m, lead: string, style: string) => {
        const kept = style
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !/^(width|margin-left|margin-right)\s*:/i.test(part))
        return `${lead}${['width:100%', ...kept].join(';')}"`
      })
  })
}

/** A block's markup as the inside of a table cell, or null when it cannot live in one. */
function cellContent(slice: string): string | null {
  if (/^<(td|th|tbody|thead|tfoot|li)\b/i.test(slice)) return null
  const content = /^<tr\b/i.test(slice) ? blockInForm(slice, false) : slice
  return content == null ? null : fullWidthBox(content)
}

const MAX_COLUMNS = 4
const COLUMN_KINDS = new Set(['row', 'sect100', 'sect50', 'sect30', 'sect25', 'sect37', 'sect73'])

/** Temporary attributes that follow elements through an edit: target, moved, source cell, removed. */
type Mark = 't' | 'm' | 's' | 'x'

function markAt(html: string, start: number, mark: Mark): string {
  const name = /^<[a-zA-Z][\w:-]*/.exec(html.slice(start))
  if (!name) return html
  const at = start + name[0].length
  return `${html.slice(0, at)} data-email-mark="${mark}"${html.slice(at)}`
}

function markAll(html: string, marks: [number, Mark][]): string {
  let next = html
  for (const [start, mark] of [...marks].sort((a, b) => b[0] - a[0])) next = markAt(next, start, mark)
  return next
}

function findMark(html: string, mark: Mark): number {
  const at = html.indexOf(` data-email-mark="${mark}"`)
  return at < 0 ? -1 : html.lastIndexOf('<', at)
}

function stripMarks(html: string, marks: Mark[]): string {
  let next = html
  for (const mark of marks) next = next.split(` data-email-mark="${mark}"`).join('')
  return next
}

function openTagOf(html: string, node: EmailElement): string {
  return html.slice(node.start, node.openEnd)
}

function blockKindOf(html: string, node: EmailElement): string {
  return /\bdata-email-block\s*=\s*["']?([\w-]+)/i.exec(openTagOf(html, node))?.[1] ?? ''
}

function isCellNode(html: string, node: EmailElement): boolean {
  return node.tag === 'td' && /\bdata-email-cell\b/i.test(openTagOf(html, node))
}

function boxOf(html: string, block: EmailElement): EmailElement | null {
  const isBox = (node: EmailElement) => node.tag === 'table' && /\bdata-email-box\b/i.test(openTagOf(html, node))
  if (isBox(block)) return block
  const cell = block.tag === 'tr' ? block.children.find((child) => child.tag === 'td') : null
  return cell?.children.find(isBox) ?? null
}

function rowCellsOf(html: string, block: EmailElement): EmailElement[] {
  const box = boxOf(html, block)
  if (!box) return []
  const body = box.children.find((child) => child.tag === 'tbody') ?? box
  const row = body.children.find((child) => child.tag === 'tr')
  return row ? row.children.filter((child) => isCellNode(html, child)) : []
}

/** The added layout block a section cell belongs to. */
function cellOwnerOf(html: string, cell: EmailElement): EmailElement | null {
  let node = cell.parent?.parent ?? null
  if (node?.tag === 'tbody') node = node.parent
  if (!node || node.tag !== 'table') return null
  if (blockKindOf(html, node)) return node
  const outerRow = node.parent?.parent
  return outerRow?.tag === 'tr' && blockKindOf(html, outerRow) ? outerRow : null
}

function roundPercent(value: number): number {
  return Math.round(value * 10000) / 10000
}

function withCellWidth(openTag: string, percent: number): string {
  const value = `${roundPercent(percent)}%`
  const attr = /\swidth\s*=\s*["']?[\d.]+%?["']?/i
  const sized = attr.test(openTag) ? openTag.replace(attr, ` width="${value}"`) : openTag.replace(/^<td\b/i, `<td width="${value}"`)
  return sized.replace(/(\sstyle\s*=\s*")([^"]*)"/i, (_m, lead: string, style: string) => {
    const kept = style.split(';').map((part) => part.trim()).filter((part) => part && !/^width\s*:/i.test(part))
    return `${lead}${[`width:${value}`, ...kept].join(';')}"`
  })
}

function columnCell(percent: number, content: string): string {
  const value = roundPercent(percent)
  return `<td data-email-cell width="${value}%" valign="top" style="width:${value}%;padding:8px;vertical-align:top">${content}</td>`
}

type HtmlEdit = { start: number; end: number; text: string }

function applyEdits(html: string, edits: HtmlEdit[]): string {
  let next = html
  for (const edit of [...edits].sort((a, b) => b.start - a.start || b.end - a.end)) {
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`
  }
  return next
}

/** Add or drop one column of an added row. Columns share the width equally afterwards. */
function rebuildRow(
  html: string,
  block: EmailElement,
  cells: EmailElement[],
  change: { insertAt: number; content: string } | { drop: number }
): string {
  const count = 'drop' in change ? cells.length - 1 : cells.length + 1
  const percent = 100 / Math.max(1, count)
  const edits: HtmlEdit[] = []
  cells.forEach((cell, index) => {
    if ('drop' in change && index === change.drop) edits.push({ start: cell.start, end: cell.end, text: '' })
    else edits.push({ start: cell.start, end: cell.openEnd, text: withCellWidth(openTagOf(html, cell), percent) })
  })
  if ('insertAt' in change) {
    const at = change.insertAt < cells.length ? cells[change.insertAt]!.start : cells[cells.length - 1]!.end
    edits.push({ start: at, end: at, text: columnCell(percent, change.content) })
  }
  if (blockKindOf(html, block) !== 'row') {
    edits.push({ start: block.start, end: block.openEnd, text: openTagOf(html, block).replace(/(\bdata-email-block\s*=\s*["']?)[\w-]+/i, '$1row') })
  }
  return applyEdits(html, edits)
}

/**
 * Put `content` beside the element at `targetStart`. A block that already sits alone in a column
 * (or a layout row itself) gains a new column; anything else becomes a new two-column row.
 */
function besideAt(html: string, targetStart: number, side: 'left' | 'right', content: string): string | null {
  const target = findEmailElementAt(html, targetStart)
  if (!target) return null
  const hasRoom = (cells: EmailElement[]) => {
    const leaving = cells.filter((cell) => !cell.children.length && /data-email-mark="s"/.test(openTagOf(html, cell))).length
    return cells.length - leaving < MAX_COLUMNS
  }
  if (COLUMN_KINDS.has(blockKindOf(html, target))) {
    const cells = rowCellsOf(html, target)
    if (cells.length && hasRoom(cells)) return rebuildRow(html, target, cells, { insertAt: side === 'left' ? 0 : cells.length, content })
  }
  const cell = target.parent
  if (cell && isCellNode(html, cell) && cell.children.length === 1) {
    const owner = cellOwnerOf(html, cell)
    if (owner && COLUMN_KINDS.has(blockKindOf(html, owner))) {
      const cells = rowCellsOf(html, owner)
      const index = cells.findIndex((entry) => entry.start === cell.start)
      if (index >= 0 && hasRoom(cells)) return rebuildRow(html, owner, cells, { insertAt: side === 'left' ? index : index + 1, content })
    }
  }
  const own = cellContent(html.slice(target.start, target.end))
  if (own == null) return null
  const cells = (side === 'left' ? [content, own] : [own, content]).map((entry) => columnCell(50, entry)).join('')
  const wrapper = target.tag === 'tr'
    ? `<tr data-email-block="row"><td align="center" style="padding:0"><table ${TABLE_ATTRS} data-email-box style="width:100%"><tr>${cells}</tr></table></td></tr>`
    : `<table ${TABLE_ATTRS} data-email-block="row" data-email-box style="width:100%"><tr>${cells}</tr></table>`
  return `${html.slice(0, target.start)}${wrapper}${html.slice(target.end)}`
}

/**
 * The column a block left (marked `s`): in rows made by placing blocks side by side, an empty
 * column is removed, and a row left with one column turns back into full-width blocks.
 */
function collapseSource(html: string): string {
  const at = findMark(html, 's')
  if (at < 0) return html
  const cell = findEmailElementAt(html, at)
  if (!cell || cell.children.length || html.slice(cell.openEnd, cell.end).replace(/<\/td\s*>$/i, '').trim()) return html
  const owner = cellOwnerOf(html, cell)
  if (!owner || blockKindOf(html, owner) !== 'row') return html
  const cells = rowCellsOf(html, owner)
  const index = cells.findIndex((entry) => entry.start === cell.start)
  if (index < 0) return html
  if (cells.length > 2) return rebuildRow(html, owner, cells, { drop: index })
  const parts = cells
    .filter((_, i) => i !== index)
    .flatMap((entry) => entry.children.map((child) => html.slice(child.start, child.end)))
  if (!parts.length) return `${html.slice(0, owner.start)}${html.slice(owner.end)}`
  const converted = parts.map((part) => blockInForm(part, owner.tag === 'tr'))
  if (converted.some((part) => part == null)) return rebuildRow(html, owner, cells, { drop: index })
  return `${html.slice(0, owner.start)}${converted.join('')}${html.slice(owner.end)}`
}

/** The smallest arrange item containing `at`. */
function innermostPartAt(html: string, at: number): number | null {
  let best: { part: number; start: number } | null = null
  for (const item of listEmailArrangeItems(html)) {
    if (item.start <= at && at < item.end && (!best || item.start > best.start)) best = { part: item.part, start: item.start }
  }
  return best?.part ?? null
}

function finishMarked(html: string, original: string): EmailBlockEdit {
  let next = restoreEmptyCells(stripMarks(html, ['t', 's', 'x']), 0).html
  const at = findMark(next, 'm')
  next = stripMarks(next, ['m'])
  if (next === original) return { html: original, part: null }
  return { html: next, part: at < 0 ? null : innermostPartAt(next, at) }
}

/** Add a new block beside another one. */
export function insertEmailBlockBeside(
  html: string,
  kind: EmailBlockKind,
  targetPart: number,
  side: 'left' | 'right',
  imageUrl?: string
): EmailBlockEdit {
  const target = listEmailArrangeItems(html)[targetPart]
  const block = emailBlockHtml(kind, false, imageUrl)
  if (!target || !block) return { html, part: null }
  const marked = markAt(html, target.start, 't')
  const placed = besideAt(marked, findMark(marked, 't'), side, markAt(block, 0, 'm'))
  return placed == null ? { html, part: null } : finishMarked(placed, html)
}

/** Split the width of a column and the one to its right. `leftPercent` is of the whole row. */
export function setEmailColumnSplit(html: string, leftCell: number, leftPercent: number): string {
  const open = [...html.matchAll(CELL_OPEN_RE)][leftCell]
  const left = open ? findEmailElementAt(html, open.index) : null
  const siblings = left?.parent?.children ?? []
  const right = siblings[siblings.findIndex((node) => node.start === left?.start) + 1]
  if (!left || !right || !isCellNode(html, right)) return html
  const share = (node: EmailElement) => Number(/\bwidth\s*=\s*["']?([\d.]+)%/i.exec(openTagOf(html, node))?.[1]) || 100 / siblings.length
  const total = share(left) + share(right)
  const nextLeft = Math.max(total * 0.1, Math.min(total * 0.9, leftPercent))
  return applyEdits(html, [
    { start: left.start, end: left.openEnd, text: withCellWidth(openTagOf(html, left), nextLeft) },
    { start: right.start, end: right.openEnd, text: withCellWidth(openTagOf(html, right), total - nextLeft) }
  ])
}

/** A block's markup as a table row or as a standalone table. Only added blocks can switch. */
function blockInForm(slice: string, asRow: boolean): string | null {
  const isRow = /^<tr\b/i.test(slice)
  if (isRow === asRow) return slice
  const kind = /^<\w+\b[^>]*\bdata-email-block\s*=\s*["']?([\w-]+)/i.exec(slice)?.[1]
  if (!kind) return null
  if (asRow) {
    if (!/^<table\b[^>]*\bdata-email-box\b/i.test(slice)) return null
    const table = slice.replace(/\sdata-email-block\s*=\s*["']?[\w-]+["']?/i, '')
    return `<tr data-email-block="${kind}"><td align="center" style="padding:0">${table}</td></tr>`
  }
  const inner = /^<tr\b[^>]*>\s*<td\b[^>]*>([\s\S]*)<\/td>\s*<\/tr>$/i.exec(slice)?.[1]?.trim()
  if (!inner || !/^<table\b[^>]*\bdata-email-box\b/i.test(inner)) return null
  return inner.replace(/^<table\b/i, `<table data-email-block="${kind}"`)
}

/** Move a block next to another block or into a section cell, anywhere in the email. */
export function moveEmailBlock(html: string, part: number, target: EmailBlockTarget): EmailBlockEdit {
  const items = listEmailArrangeItems(html)
  const item = items[part]
  if (!item) return { html, part }
  const node = findEmailElementAt(html, item.start)
  const sourceCell = node?.parent && isCellNode(html, node.parent) ? node.parent : null
  if ('side' in target) {
    const anchor = items[target.part]
    if (!anchor || target.part === part || (anchor.start < item.end && item.start < anchor.end)) return { html, part }
    const content = cellContent(html.slice(item.start, item.end))
    if (content == null) return { html, part }
    const marks: [number, Mark][] = [[anchor.start, 't'], [item.start, 'x']]
    if (sourceCell) marks.push([sourceCell.start, 's'])
    let next = markAll(html, marks)
    const removed = findEmailElementAt(next, findMark(next, 'x'))
    if (!removed) return { html, part }
    next = `${next.slice(0, removed.start)}${next.slice(removed.end)}`
    const placed = besideAt(next, findMark(next, 't'), target.side, markAt(content, 0, 'm'))
    if (placed == null) return { html, part }
    const edit = finishMarked(collapseSource(placed), html)
    return edit.part == null ? { html, part } : edit
  }
  const inside = (at: number) => at >= item.start && at < item.end
  let at: number
  let asRow: boolean
  let cell: { start: number; tag: string } | null = null
  if ('cell' in target) {
    const open = [...html.matchAll(CELL_OPEN_RE)][target.cell]
    if (!open || inside(open.index)) return { html, part }
    const end = emailArrangeGroupInnerEnd(html, `p${open.index}:td`)
    if (end == null) return { html, part }
    at = end
    asRow = false
    cell = { start: open.index, tag: open[0] }
  } else {
    const anchor = items[target.part]
    if (!anchor || target.part === part || inside(anchor.start)) return { html, part }
    at = target.place === 'before' ? anchor.start : anchor.end
    asRow = ROW_PARENTS.has(parentTag(anchor.group))
  }
  const slice = html.slice(item.start, item.end)
  const inForm = blockInForm(slice, asRow)
  if (inForm == null) return { html, part }
  const moved = markAt(inForm, 0, 'm')
  const shift = (pos: number) => (pos > item.start ? pos - slice.length : pos)
  let next = `${html.slice(0, item.start)}${html.slice(item.end)}`
  let insertAt = shift(at)
  let sourceAt = sourceCell ? sourceCell.start : -1
  if (cell) {
    const cellAt = shift(cell.start)
    const freed = freeCellTag(cell.tag)
    next = `${next.slice(0, cellAt)}${freed}${next.slice(cellAt + cell.tag.length)}`
    insertAt += freed.length - cell.tag.length
    if (sourceAt > cellAt) sourceAt += freed.length - cell.tag.length
  }
  next = `${next.slice(0, insertAt)}${moved}${next.slice(insertAt)}`
  if (sourceAt >= 0) {
    if (insertAt <= sourceAt) sourceAt += moved.length
    next = collapseSource(markAt(next, sourceAt, 's'))
  }
  const edit = finishMarked(next, html)
  return edit.part == null ? { html, part } : edit
}

/** Copy a block and place the copy right after it. */
export function duplicateEmailBlock(html: string, part: number): EmailBlockEdit {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return { html, part }
  const copy = html.slice(item.start, item.end)
  const next = `${html.slice(0, item.end)}${copy}${html.slice(item.end)}`
  return { html: next, part: partAt(next, item.end) }
}

/** Remove a block and everything inside it. */
export function removeEmailBlock(html: string, part: number): string {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return html
  const node = findEmailElementAt(html, item.start)
  const sourceCell = node?.parent && isCellNode(html, node.parent) ? node.parent : null
  let next = markAll(html, sourceCell ? [[item.start, 'x'], [sourceCell.start, 's']] : [[item.start, 'x']])
  const removed = findEmailElementAt(next, findMark(next, 'x'))
  if (!removed) return html
  next = collapseSource(`${next.slice(0, removed.start)}${next.slice(removed.end)}`)
  return restoreEmptyCells(stripMarks(next, ['s', 't', 'm', 'x']), 0).html
}

const LINK_OPEN_RE = /<a\b[^>]*>/i
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

/** The link inside a block, or null when the block has no link or several. */
/** A Button's fill and corner radius, or a Divider's line color and thickness. */
export type EmailBlockAccent = { kind: 'button' | 'divider', color: string, size: number }

const ACCENT_TAG: Record<EmailBlockAccent['kind'], RegExp> = {
  button: /<td\b[^>]*\bbgcolor\s*=[^>]*>/i,
  divider: /<td\b[^>]*\bborder-top\s*:[^>]*>/i
}
const DIVIDER_RE = /\bborder-top\s*:\s*(\d+)px\s+\w+\s+([^;"']+)/i

function accentTag(html: string, part: number): { kind: EmailBlockAccent['kind'], at: number, tag: string } | null {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return null
  const slice = html.slice(item.start, item.end)
  const kind = /^<\w+\b[^>]*\bdata-email-block\s*=\s*["']?(button|divider)\b/i.exec(slice)?.[1] as EmailBlockAccent['kind'] | undefined
  const match = kind ? ACCENT_TAG[kind].exec(slice) : null
  return kind && match ? { kind, at: item.start + match.index, tag: match[0] } : null
}

function withStyleProp(tag: string, prop: string, value: string): string {
  const style = /\bstyle\s*=\s*"([^"]*)"/i.exec(tag)
  const rule = `${prop}:${value}`
  if (!style) return tag.replace(/>$/, ` style="${rule}">`)
  const kept = style[1]!.split(';').map((entry) => entry.trim()).filter((entry) => entry && !new RegExp(`^${prop}\\s*:`, 'i').test(entry))
  return tag.replace(style[0], `style="${[...kept, rule].join(';')}"`)
}

export function readEmailBlockAccent(html: string, part: number): EmailBlockAccent | null {
  const found = accentTag(html, part)
  if (!found) return null
  if (found.kind === 'button') {
    const color = /\bbgcolor\s*=\s*["']?(#[\da-f]{3,8})/i.exec(found.tag)?.[1] ?? '#111111'
    const radius = Number(/\bborder-radius\s*:\s*(\d+)px/i.exec(found.tag)?.[1] ?? 0)
    return { kind: 'button', color, size: radius }
  }
  const line = DIVIDER_RE.exec(found.tag)
  return { kind: 'divider', color: line?.[2]?.trim() ?? '#e2e8f0', size: Number(line?.[1] ?? 1) }
}

export function updateEmailBlockAccent(html: string, part: number, patch: { color?: string, size?: number }): string {
  const found = accentTag(html, part)
  const current = readEmailBlockAccent(html, part)
  if (!found || !current) return html
  const color = patch.color && /^#[\da-f]{3,8}$/i.test(patch.color) ? patch.color : current.color
  const size = patch.size != null && Number.isFinite(patch.size) ? Math.round(patch.size) : current.size
  let tag = found.tag
  if (found.kind === 'button') {
    tag = tag.replace(/\bbgcolor\s*=\s*["']?[^"'\s>]*["']?/i, `bgcolor="${color}"`)
    tag = withStyleProp(withStyleProp(tag, 'border-radius', `${Math.max(0, Math.min(60, size))}px`), 'background-color', color)
  } else {
    tag = withStyleProp(tag, 'border-top', `${Math.max(1, Math.min(20, size))}px solid ${color}`)
  }
  return tag === found.tag ? html : `${html.slice(0, found.at)}${tag}${html.slice(found.at + found.tag.length)}`
}

export function readEmailBlockLink(html: string, part: number): string | null {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return null
  const slice = html.slice(item.start, item.end)
  if ((slice.match(/<a\b/gi) ?? []).length !== 1) return null
  const open = LINK_OPEN_RE.exec(slice)
  if (!open) return null
  const href = HREF_RE.exec(open[0])
  return (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').replace(/&amp;/g, '&')
}

/** Web, email, phone, and merge-tag links only. */
export function parseEmailBlockLink(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/^\{\{[\s\S]+\}\}$/.test(value)) return value
  if (/^(mailto|tel):\S+$/i.test(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

export type EmailBlockLinkItem = { index: number, href: string, label: string }

const LINK_PAIR_RE = /<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi

/** Every link inside one block, named by its title or its words. */
export function listEmailBlockLinks(html: string, part: number): EmailBlockLinkItem[] {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return []
  const slice = html.slice(item.start, item.end)
  return [...slice.matchAll(LINK_PAIR_RE)].map((match, index) => {
    const open = LINK_OPEN_RE.exec(match[0])?.[0] ?? ''
    const href = HREF_RE.exec(open)
    const title = /\btitle\s*=\s*"([^"]*)"/i.exec(open)?.[1]
    const words = (match[1] ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#9654;/g, '').trim()
    return {
      index,
      href: (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').replace(/&amp;/g, '&'),
      label: title || words || `Link ${index + 1}`
    }
  })
}

/** Point one link inside a block somewhere else. */
export function updateEmailBlockLinkAt(html: string, part: number, index: number, raw: string): string {
  const href = parseEmailBlockLink(raw)
  const item = listEmailArrangeItems(html)[part]
  if (!href || !item) return html
  const slice = html.slice(item.start, item.end)
  const open = [...slice.matchAll(/<a\b[^>]*>/gi)][index]
  if (!open || open.index == null) return html
  const safe = escapeAttr(href)
  const nextOpen = HREF_RE.test(open[0])
    ? open[0].replace(HREF_RE, `href="${safe}"`)
    : open[0].replace(/^<a\b/i, `<a href="${safe}"`)
  const at = item.start + open.index
  return `${html.slice(0, at)}${nextOpen}${html.slice(at + open[0].length)}`
}

/** The cell inside an HTML or Video block that holds its markup. */
function blockInner(html: string, part: number, marker: 'data-email-html' | 'data-email-video'): { start: number, end: number } | null {
  const item = listEmailArrangeItems(html)[part]
  if (!item) return null
  const at = html.slice(item.start, item.end).search(new RegExp(`<td\\b[^>]*\\b${marker}\\b`, 'i'))
  if (at < 0) return null
  const node = findEmailElementAt(html, item.start + at)
  if (!node) return null
  const close = html.lastIndexOf('<', node.end - 1)
  return close >= node.openEnd ? { start: node.openEnd, end: close } : null
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const BLOCKED_TAGS = 'script|style|iframe|frame|frameset|object|embed|applet|form|input|button|textarea|select|option|link|meta|base'

/** Custom HTML without scripts or event handlers, and only when every tag is closed. */
export function cleanEmailCustomHtml(raw: string): string | null {
  let value = String(raw ?? '').trim()
  if (!value) return null
  value = value
    .replace(new RegExp(`<(${BLOCKED_TAGS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\/?(?:${BLOCKED_TAGS})\\b[^>]*>`, 'gi'), '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\b(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data):[^"']*\2/gi, '$1="#"')
    .replace(/<!--[\s\S]*?-->/g, '')
  const stack: string[] = []
  for (const match of value.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*?(\/?)>/gi)) {
    const tag = match[2]!.toLowerCase()
    if (VOID_TAGS.has(tag) || match[3]) continue
    if (!match[1]) stack.push(tag)
    else if (stack.pop() !== tag) return null
  }
  if (stack.length || /<(?![a-z/!])/i.test(value.replace(/<\/?[a-z][^>]*>/gi, ''))) return null
  return value.trim() || null
}

export function readEmailBlockHtml(html: string, part: number): string | null {
  const inner = blockInner(html, part, 'data-email-html')
  return inner ? html.slice(inner.start, inner.end) : null
}

export function updateEmailBlockHtml(html: string, part: number, raw: string): string | null {
  const inner = blockInner(html, part, 'data-email-html')
  const clean = cleanEmailCustomHtml(raw)
  if (!inner || clean == null) return null
  return `${html.slice(0, inner.start)}${clean}${html.slice(inner.end)}`
}

function youtubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\.|^m\./, '')
    const id = host === 'youtu.be'
      ? parsed.pathname.slice(1)
      : host === 'youtube.com'
        ? parsed.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(parsed.pathname)?.[1] ?? ''
        : ''
    return /^[\w-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function readEmailBlockVideo(html: string, part: number): string | null {
  const inner = blockInner(html, part, 'data-email-video')
  if (!inner) return null
  const href = HREF_RE.exec(html.slice(inner.start, inner.end))
  return (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').replace(/&amp;/g, '&')
}

/** Link a Video block to a video. YouTube links also show the video's thumbnail. */
export function updateEmailBlockVideo(html: string, part: number, raw: string): string | null {
  const inner = blockInner(html, part, 'data-email-video')
  const href = parseEmailBlockLink(raw)
  if (!inner || !href || !/^https?:/i.test(href)) return null
  return `${html.slice(0, inner.start)}${videoInner(href, youtubeId(href))}${html.slice(inner.end)}`
}

/** Point the first link inside a block somewhere else. */
export function updateEmailBlockLink(html: string, part: number, raw: string): string {
  const href = parseEmailBlockLink(raw)
  const item = listEmailArrangeItems(html)[part]
  if (!href || !item || readEmailBlockLink(html, part) == null) return html
  const slice = html.slice(item.start, item.end)
  const open = LINK_OPEN_RE.exec(slice)
  if (!open) return html
  const safe = href.replace(/&(?!amp;)/g, '&amp;').replace(/"/g, '&quot;')
  const nextOpen = HREF_RE.test(open[0])
    ? open[0].replace(HREF_RE, `href="${safe}"`)
    : open[0].replace(/^<a\b/i, `<a href="${safe}"`)
  const at = item.start + open.index
  return `${html.slice(0, at)}${nextOpen}${html.slice(at + open[0].length)}`
}
