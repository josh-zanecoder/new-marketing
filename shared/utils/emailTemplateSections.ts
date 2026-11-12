const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
])
const SECTION_TAGS = new Set(['tr', 'div', 'section', 'article', 'header', 'footer', 'center', 'table'])
const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'li', 'blockquote'])

export type EmailArrangeKind = 'section' | 'text' | 'image'

export type EmailArrangeItem = {
  part: number
  kind: EmailArrangeKind
  label: string
  depth: number
  group: string
  start: number
  end: number
  openEnd: number
}

type EmailNode = {
  tag: string
  start: number
  openEnd: number
  end: number
  closed: boolean
  parent: EmailNode | null
  children: EmailNode[]
}

type TagToken = {
  closing: boolean
  tag: string
  start: number
  end: number
  selfClosing: boolean
}

function scanTags(html: string): TagToken[] {
  const tokens: TagToken[] = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) break
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end < 0 ? html.length : end + 3
      continue
    }
    if (/^<!/i.test(html.slice(lt, lt + 2))) {
      const end = html.indexOf('>', lt + 2)
      i = end < 0 ? html.length : end + 1
      continue
    }
    const nameMatch = /^<\/?\s*([a-zA-Z][\w:-]*)/.exec(html.slice(lt))
    if (!nameMatch) {
      i = lt + 1
      continue
    }
    const closing = html[lt + 1] === '/'
    const tag = nameMatch[1]!.toLowerCase()
    let cursor = lt + nameMatch[0].length
    let quote = ''
    while (cursor < html.length) {
      const ch = html[cursor]!
      if (quote) {
        if (ch === quote) quote = ''
        cursor += 1
        continue
      }
      if (ch === '"' || ch === "'") {
        quote = ch
        cursor += 1
        continue
      }
      if (ch === '>') break
      cursor += 1
    }
    if (cursor >= html.length) break
    const raw = html.slice(lt, cursor)
    const selfClosing = /\/\s*$/.test(raw) || VOID_TAGS.has(tag)
    tokens.push({ closing, tag, start: lt, end: cursor + 1, selfClosing: selfClosing && !closing })
    i = cursor + 1
    if (!closing && (tag === 'script' || tag === 'style')) {
      const last = tokens[tokens.length - 1]
      if (last) last.selfClosing = true
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
      const rest = html.slice(i)
      const found = closeRe.exec(rest)
      i = found ? i + found.index + found[0].length : html.length
    }
  }
  return tokens
}

function buildTree(html: string): EmailNode {
  const root: EmailNode = {
    tag: '#root',
    start: 0,
    openEnd: 0,
    end: html.length,
    closed: true,
    parent: null,
    children: []
  }
  const stack: EmailNode[] = [root]
  for (const token of scanTags(html)) {
    if (token.closing) {
      for (let index = stack.length - 1; index > 0; index -= 1) {
        const node = stack[index]
        if (!node || node.tag !== token.tag) continue
        node.end = token.end
        node.closed = true
        stack.splice(index)
        break
      }
      continue
    }
    const parent = stack[stack.length - 1] ?? root
    const node: EmailNode = {
      tag: token.tag,
      start: token.start,
      openEnd: token.end,
      end: token.end,
      closed: token.selfClosing,
      parent,
      children: []
    }
    parent.children.push(node)
    if (!token.selfClosing) stack.push(node)
  }
  return root
}

const SKIP_TEXT_TAGS = new Set(['style', 'script', 'title', 'noscript'])

export type EmailTextRun = {
  index: number
  text: string
  start: number
  end: number
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (full, digits: string) => fromCodePoint(Number(digits), full))
    .replace(/&#x([0-9a-f]+);/gi, (full, hex: string) => fromCodePoint(Number.parseInt(hex, 16), full))
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function fromCodePoint(code: number, fallback: string): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return fallback
  try {
    return String.fromCodePoint(code)
  } catch {
    return fallback
  }
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function visibleText(html: string): string {
  return decodeHtmlText(
    html
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Spaces and non-breaking spaces that only separate this phrase from the next one. */
function edgeGap(raw: string, side: 'lead' | 'tail'): number {
  const gap = '(?:\\s|&nbsp;|&#0*160;|&#x0*a0;)'
  const pattern = side === 'lead' ? new RegExp(`^${gap}+`, 'i') : new RegExp(`${gap}+$`, 'i')
  return pattern.exec(raw)?.[0].length ?? 0
}

function addPlainRun(html: string, start: number, end: number, runs: EmailTextRun[]) {
  if (end <= start) return
  const raw = html.slice(start, end)
  if (/^\s*<!doctype\b[^>]*>\s*$/i.test(raw)) return
  // Leave the gap between two colored phrases outside the run, so editing one does not delete it.
  const from = start + edgeGap(raw, 'lead')
  const to = end - edgeGap(raw, 'tail')
  if (to <= from) return
  const text = decodeHtmlText(html.slice(from, to)).replace(/\u00a0/g, ' ').trim()
  if (!text) return
  runs.push({ index: runs.length, text, start: from, end: to })
}

function addRuns(html: string, start: number, end: number, runs: EmailTextRun[]) {
  if (end <= start) return
  const slice = html.slice(start, end)
  const comments = /<!--[\s\S]*?-->/g
  let cursor = start
  let match: RegExpExecArray | null
  while ((match = comments.exec(slice))) {
    const at = start + match.index
    addPlainRun(html, cursor, at, runs)
    cursor = at + match[0].length
  }
  addPlainRun(html, cursor, end, runs)
}

/** Visible text between tags. Spacer entities and style or script contents are left out. */
export function listEmailTextRuns(html: string): EmailTextRun[] {
  const runs: EmailTextRun[] = []
  let cursor = 0
  for (const token of scanTags(html)) {
    if (cursor < token.start) addRuns(html, cursor, token.start, runs)
    let next = token.end
    if (!token.closing && SKIP_TEXT_TAGS.has(token.tag)) {
      const found = new RegExp(`</${token.tag}\\s*>`, 'i').exec(html.slice(token.end))
      next = found ? token.end + found.index + found[0].length : html.length
    }
    cursor = Math.max(cursor, next)
  }
  if (cursor < html.length) addRuns(html, cursor, html.length, runs)
  return runs
}

/** Replace the text between two offsets and leave the surrounding tags in place. */
export function replaceEmailTextAt(
  html: string,
  start: number,
  end: number,
  nextText: string,
  trimEdges = false
): { html: string, end: number } {
  if (start < 0 || end < start || end > html.length) return { html, end }
  const current = html.slice(start, end)
  if (/[<>]/.test(current)) return { html, end }
  const clean = nextText.replace(/\u00a0/g, ' ')
  const stored = trimEdges ? clean.trim() : clean
  const encoded = escapeHtmlText(stored).replace(/\r\n|\r|\n/g, '<br>')
  if (current === encoded) return { html, end }
  return {
    html: `${html.slice(0, start)}${encoded}${html.slice(end)}`,
    end: start + encoded.length
  }
}

/** Replace one text run and leave the surrounding tags in place. */
export function replaceEmailTextRun(html: string, index: number, nextText: string): string {
  const run = listEmailTextRuns(html)[index]
  if (!run) return html
  return replaceEmailTextAt(html, run.start, run.end, nextText, true).html
}

export const EMAIL_TEXT_FONTS = [
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, Times, serif' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'times', label: 'Times', stack: "'Times New Roman', Times, serif" }
] as const

export const EMAIL_TEXT_SIZES = [
  { px: 14, label: 'Small' },
  { px: 16, label: 'Normal' },
  { px: 18, label: 'Medium' },
  { px: 24, label: 'Large' },
  { px: 32, label: 'Title' }
] as const

export const EMAIL_TEXT_SIZE_MIN = 8
export const EMAIL_TEXT_SIZE_MAX = 96

export type EmailTextFontId = (typeof EMAIL_TEXT_FONTS)[number]['id']

export type EmailTextStyle = {
  font: '' | EmailTextFontId
  size: number | null
  color: string
  bold: boolean
  italic: boolean
}

export type EmailTextStylePatch = {
  font?: '' | EmailTextFontId
  size?: number | null
  color?: string | null
  bold?: boolean
  italic?: boolean
}

const STYLE_OWNER_SKIP = new Set(['html', 'body', 'head', 'table', 'tbody', 'thead', 'tfoot', 'tr'])
const BOLD_TAGS = new Set(['b', 'strong', 'h1', 'h2', 'h3'])
const ITALIC_TAGS = new Set(['i', 'em'])

function parseStyle(value: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of value.split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const key = part.slice(0, colon).trim().toLowerCase()
    const val = part.slice(colon + 1).trim().replace(/\s*!important\s*$/i, '')
    if (key && val) map.set(key, val)
  }
  return map
}

function styleAttributeValue(openTag: string): string {
  const match = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(openTag)
  return match?.[2] ?? ''
}

function setStyleProperties(openTag: string, updates: Record<string, string | null>): string {
  const match = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(openTag)
  const map = parseStyle(match?.[2] ?? '')
  for (const [key, value] of Object.entries(updates)) {
    if (!value) map.delete(key)
    else map.set(key, value)
  }
  const style = [...map.entries()].map(([key, value]) => `${key}:${value}`).join(';')
  if (match) {
    if (!style) {
      return `${openTag.slice(0, match.index)}${openTag.slice(match.index + match[0].length)}`
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+>/, '>')
    }
    const quote = match[1] === "'" ? "'" : '"'
    const safe = quote === '"' ? style.replace(/"/g, "'") : style.replace(/'/g, '')
    return `${openTag.slice(0, match.index)}style=${quote}${safe}${quote}${openTag.slice(match.index + match[0].length)}`
  }
  if (!style) return openTag
  const gt = openTag.lastIndexOf('>')
  if (gt < 0) return openTag
  return `${openTag.slice(0, gt)} style="${style.replace(/"/g, "'")}"${openTag.slice(gt)}`
}

function elementsContaining(html: string, run: EmailTextRun): EmailNode[] {
  const found: EmailNode[] = []
  const visit = (node: EmailNode) => {
    if (node.tag !== '#root') {
      if (!(node.closed && node.openEnd <= run.start && node.end >= run.end)) return
      found.push(node)
    }
    for (const child of node.children) visit(child)
  }
  visit(buildTree(html))
  return found
}

function soleTextRun(node: EmailNode, runs: EmailTextRun[], index: number): boolean {
  const inside = runs.filter((entry) => entry.start >= node.openEnd && entry.end <= node.end)
  return inside.length === 1 && inside[0]?.index === index
}

function normalizeHex(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  const short = /^#([0-9a-f]{3})$/.exec(value)
  if (short?.[1]) {
    const [r, g, b] = short[1]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(value)
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map((part) => Math.max(0, Math.min(255, Number(part))))
    return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`
  }
  const names: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    gray: '#808080',
    grey: '#808080'
  }
  return names[value] ?? null
}

function fontIdFromFamily(value: string): '' | EmailTextFontId {
  const name = value.replace(/["']/g, '').split(',')[0]?.trim().toLowerCase() ?? ''
  if (name === 'arial' || name === 'helvetica') return 'arial'
  if (name === 'georgia') return 'georgia'
  if (name === 'verdana' || name === 'geneva') return 'verdana'
  if (name === 'times' || name === 'times new roman') return 'times'
  return ''
}

function fontSizePx(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(value.trim())
  if (!match?.[1]) return null
  const px = Math.round(Number(match[1]))
  if (px < EMAIL_TEXT_SIZE_MIN || px > EMAIL_TEXT_SIZE_MAX) return null
  return px
}

function styleUpdates(patch: EmailTextStylePatch): Record<string, string | null> | null {
  const updates: Record<string, string | null> = {}
  if (patch.font !== undefined) {
    const font = EMAIL_TEXT_FONTS.find((entry) => entry.id === patch.font)
    updates['font-family'] = font?.stack ?? null
  }
  if (patch.size !== undefined) {
    if (patch.size == null) updates['font-size'] = null
    else if (Number.isInteger(patch.size) && patch.size >= EMAIL_TEXT_SIZE_MIN && patch.size <= EMAIL_TEXT_SIZE_MAX) updates['font-size'] = `${patch.size}px`
  }
  if (patch.color !== undefined) {
    updates.color = patch.color ? normalizeHex(patch.color) : null
    if (patch.color && !updates.color) return null
  }
  if (patch.bold !== undefined) updates['font-weight'] = patch.bold ? '700' : '400'
  if (patch.italic !== undefined) updates['font-style'] = patch.italic ? 'italic' : 'normal'
  return updates
}

function readStyleFromChain(html: string, chain: EmailNode[]): EmailTextStyle {
  const style: EmailTextStyle = { font: '', size: null, color: '', bold: false, italic: false }
  let boldKnown = false
  let italicKnown = false
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const node = chain[index]
    if (!node) continue
    const map = parseStyle(styleAttributeValue(html.slice(node.start, node.openEnd)))
    if (!style.font) style.font = fontIdFromFamily(map.get('font-family') ?? '')
    if (style.size == null) style.size = fontSizePx(map.get('font-size') ?? '')
    if (!style.color) style.color = normalizeHex(map.get('color') ?? '') ?? ''
    if (!boldKnown) {
      const weight = (map.get('font-weight') ?? '').toLowerCase()
      if (weight === 'normal' || weight === '400' || weight === 'lighter') {
        style.bold = false
        boldKnown = true
      } else if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) {
        style.bold = true
        boldKnown = true
      } else if (BOLD_TAGS.has(node.tag)) {
        style.bold = true
        boldKnown = true
      }
    }
    if (!italicKnown) {
      const slant = (map.get('font-style') ?? '').toLowerCase()
      if (slant === 'normal') {
        style.italic = false
        italicKnown = true
      } else if (slant === 'italic' || slant === 'oblique') {
        style.italic = true
        italicKnown = true
      } else if (ITALIC_TAGS.has(node.tag)) {
        style.italic = true
        italicKnown = true
      }
    }
  }
  return style
}

/** Font, size, color, bold, and italic currently showing on one text run. */
export function readEmailTextStyle(html: string, index: number): EmailTextStyle {
  const runs = listEmailTextRuns(html)
  const run = runs[index]
  if (!run) return { font: '', size: null, color: '', bold: false, italic: false }
  return readStyleFromChain(html, elementsContaining(html, run))
}

/** Write inline font, size, color, bold, or italic onto the words. Other styles stay put. */
export function updateEmailTextStyle(html: string, index: number, patch: EmailTextStylePatch): string {
  const updates = styleUpdates(patch)
  if (!updates || Object.keys(updates).length === 0) return html
  const runs = listEmailTextRuns(html)
  const run = runs[index]
  if (!run || html.slice(run.start, run.end).includes('<')) return html
  const owner = [...elementsContaining(html, run)].reverse().find((node) =>
    !STYLE_OWNER_SKIP.has(node.tag) && soleTextRun(node, runs, index)
  )
  if (!owner) {
    const open = `<span style="${Object.entries(updates).filter((entry) => entry[1]).map(([key, value]) => `${key}:${value}`).join(';')}">`
    if (open === '<span style="">') return html
    return `${html.slice(0, run.start)}${open}${html.slice(run.start, run.end)}</span>${html.slice(run.end)}`
  }
  const openTag = html.slice(owner.start, owner.openEnd)
  const nextOpen = setStyleProperties(openTag, updates)
  if (nextOpen === openTag) return html
  return `${html.slice(0, owner.start)}${nextOpen}${html.slice(owner.openEnd)}`
}

export type EmailSectionBox = {
  background: string
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  width: number | null
  marginLeft: number
}

export type EmailSectionBoxPatch = {
  background?: string | null
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  width?: number | null
  marginLeft?: number
}

function cssPx(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(-?\d+(?:\.\d+)?)px$/i.exec(value.trim())
  if (!match?.[1]) return null
  const px = Math.round(Number(match[1]))
  return Number.isFinite(px) ? px : null
}

function paddingBox(map: Map<string, string>): Pick<EmailSectionBox, 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'> {
  const top = cssPx(map.get('padding-top'))
  const right = cssPx(map.get('padding-right'))
  const bottom = cssPx(map.get('padding-bottom'))
  const left = cssPx(map.get('padding-left'))
  const parts = (map.get('padding') ?? '').trim().split(/\s+/).filter(Boolean).map((part) => cssPx(part) ?? 0)
  let sTop = 0
  let sRight = 0
  let sBottom = 0
  let sLeft = 0
  if (parts.length === 1) sTop = sRight = sBottom = sLeft = parts[0] ?? 0
  else if (parts.length === 2) {
    sTop = sBottom = parts[0] ?? 0
    sRight = sLeft = parts[1] ?? 0
  } else if (parts.length === 3) {
    sTop = parts[0] ?? 0
    sRight = sLeft = parts[1] ?? 0
    sBottom = parts[2] ?? 0
  } else if (parts.length >= 4) {
    sTop = parts[0] ?? 0
    sRight = parts[1] ?? 0
    sBottom = parts[2] ?? 0
    sLeft = parts[3] ?? 0
  }
  return {
    paddingTop: top ?? sTop,
    paddingRight: right ?? sRight,
    paddingBottom: bottom ?? sBottom,
    paddingLeft: left ?? sLeft
  }
}

function backgroundFromOpenTag(openTag: string): string {
  const map = parseStyle(styleAttributeValue(openTag))
  const painted = normalizeHex(map.get('background-color') ?? '') || normalizeHex((map.get('background') ?? '').split(/\s+/)[0] ?? '')
  if (painted) return painted
  const attr = /\bbgcolor\s*=\s*(["']?)([^"'\s>]+)\1/i.exec(openTag)
  return normalizeHex(attr?.[2] ?? '') ?? ''
}

function setBgColorAttribute(openTag: string, value: string | null): string {
  const quoted = /\s+\bbgcolor\s*=\s*(["'])[\s\S]*?\1/i
  const bare = /\s+\bbgcolor\s*=\s*[^\s"'>]+/i
  const stripped = openTag.replace(quoted, '').replace(bare, '')
  if (!value) return stripped
  const gt = stripped.lastIndexOf('>')
  if (gt < 0) return openTag
  return `${stripped.slice(0, gt)} bgcolor="${value}"${stripped.slice(gt)}`
}

function findElementAt(html: string, start: number): EmailNode | null {
  let found: EmailNode | null = null
  const visit = (node: EmailNode) => {
    if (found) return
    if (node.tag !== '#root' && node.start === start) {
      found = node
      return
    }
    for (const child of node.children) visit(child)
  }
  visit(buildTree(html))
  return found
}

function sectionStyleNodes(html: string, part: number): EmailNode[] {
  const item = listEmailArrangeItems(html)[part]
  if (!item || item.kind === 'image') return []
  const node = findElementAt(html, item.start)
  if (!node) return []
  if (node.tag === 'tr') {
    const cells = node.children.filter((child) => child.tag === 'td' || child.tag === 'th')
    if (cells.length) return cells
  }
  return [node]
}

function clampSectionPad(value: number): number {
  return Math.max(0, Math.min(160, Math.round(value)))
}

function clampSectionWidth(value: number): number {
  return Math.max(80, Math.min(1200, Math.round(value)))
}

/** The heading or paragraph inside a section. Width belongs on this box so the words stay inside it. */
function textBoxNodes(root: EmailNode): EmailNode[] {
  const found: EmailNode[] = []
  const visit = (node: EmailNode) => {
    if (TEXT_TAGS.has(node.tag)) found.push(node)
    for (const child of node.children) {
      if (child.tag === 'table') continue
      visit(child)
    }
  }
  if (TEXT_TAGS.has(root.tag)) found.push(root)
  else for (const child of root.children) visit(child)
  return found
}

function spanNodes(root: EmailNode): EmailNode[] {
  const found: EmailNode[] = []
  const visit = (node: EmailNode) => {
    if (node.tag === 'span') found.push(node)
    for (const child of node.children) {
      if (child.tag === 'table') continue
      visit(child)
    }
  }
  visit(root)
  return found
}

function readBoxWidth(openTag: string): number | null {
  const fromStyle = cssPx(parseStyle(styleAttributeValue(openTag)).get('width'))
  if (fromStyle != null) return fromStyle
  const attr = /\bwidth\s*=\s*(["']?)(\d+(?:\.\d+)?)(?:px)?\1/i.exec(openTag)
  if (!attr?.[2]) return null
  const px = Math.round(Number(attr[2]))
  return Number.isFinite(px) ? px : null
}

function readMarginLeft(openTag: string): number {
  return cssPx(parseStyle(styleAttributeValue(openTag)).get('margin-left')) ?? 0
}

function setWidthAttribute(openTag: string, value: number | null): string {
  const quoted = /\s+width\s*=\s*(["'])[\s\S]*?\1/i
  const bare = /\s+width\s*=\s*[^\s"'>]+/i
  const stripped = openTag.replace(quoted, '').replace(bare, '')
  if (value == null) return stripped
  const gt = stripped.lastIndexOf('>')
  if (gt < 0) return openTag
  return `${stripped.slice(0, gt)} width="${value}"${stripped.slice(gt)}`
}

function setAlignAttribute(openTag: string, value: string | null): string {
  const quoted = /\s+align\s*=\s*(["'])[\s\S]*?\1/i
  const bare = /\s+align\s*=\s*[^\s"'>]+/i
  const stripped = openTag.replace(quoted, '').replace(bare, '')
  if (!value) return stripped
  const gt = stripped.lastIndexOf('>')
  if (gt < 0) return openTag
  return `${stripped.slice(0, gt)} align="${value}"${stripped.slice(gt)}`
}

/** The element whose width is the section's width. Rows share their table. */
function sectionWidthNode(html: string, part: number): EmailNode | null {
  const item = listEmailArrangeItems(html)[part]
  if (!item || item.kind === 'image') return null
  const node = findElementAt(html, item.start)
  if (!node) return null
  if (node.tag !== 'tr') return node
  let parent = node.parent
  while (parent) {
    if (parent.tag === 'table') return parent
    parent = parent.parent
  }
  return node
}

const EMPTY_SECTION_BOX: EmailSectionBox = {
  background: '',
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  width: null,
  marginLeft: 0
}

/** Background and padding on one section. Table rows use their cells, which email clients paint. */
export function readEmailSectionBox(html: string, part: number): EmailSectionBox {
  const node = sectionStyleNodes(html, part)[0]
  if (!node) return { ...EMPTY_SECTION_BOX }
  const openTag = html.slice(node.start, node.openEnd)
  const sized = sectionWidthNode(html, part)
  const sizeTag = sized ? html.slice(sized.start, sized.openEnd) : openTag
  return {
    background: backgroundFromOpenTag(openTag),
    ...paddingBox(parseStyle(styleAttributeValue(openTag))),
    width: readBoxWidth(sizeTag),
    marginLeft: readMarginLeft(sizeTag)
  }
}

/** Set a section background or padding and leave the rest of the email in place. */
export function updateEmailSectionBox(html: string, part: number, patch: EmailSectionBoxPatch): string {
  const nodes = sectionStyleNodes(html, part)
  if (!nodes.length) return html
  const background = patch.background === undefined ? undefined : patch.background ? normalizeHex(patch.background) : null
  if (patch.background && !background) return html
  const paddingChange = patch.paddingTop != null || patch.paddingRight != null || patch.paddingBottom != null || patch.paddingLeft != null
  let next = html
  if (patch.width !== undefined || patch.marginLeft !== undefined) {
    const sized = sectionWidthNode(next, part)
    if (sized) {
      const openTag = next.slice(sized.start, sized.openEnd)
      const width = patch.width === undefined ? readBoxWidth(openTag) : patch.width == null ? null : clampSectionWidth(patch.width)
      const marginLeft = patch.marginLeft === undefined ? readMarginLeft(openTag) : Math.max(0, Math.round(patch.marginLeft))
      const updates: Record<string, string | null> = {}
      if (patch.width !== undefined) updates.width = width == null ? null : `${width}px`
      if (patch.marginLeft !== undefined) {
        updates.margin = null
        updates['margin-left'] = `${marginLeft}px`
        updates['margin-right'] = '0'
      }
      let replaced = setStyleProperties(openTag, updates)
      if (patch.width !== undefined && /^<\s*table\b/i.test(replaced)) replaced = setWidthAttribute(replaced, width)
      if (patch.marginLeft !== undefined && /^<\s*table\b/i.test(replaced)) replaced = setAlignAttribute(replaced, 'left')
      if (replaced !== openTag) next = `${next.slice(0, sized.start)}${replaced}${next.slice(sized.openEnd)}`
    }
    const textRoot = findElementAt(next, listEmailArrangeItems(next)[part]?.start ?? -1)
    if (textRoot && patch.width !== undefined) {
      const width = patch.width == null ? null : `${clampSectionWidth(patch.width)}px`
      const boxes = [...textBoxNodes(textRoot), ...spanNodes(textRoot)].sort((a, b) => b.start - a.start)
      for (const node of boxes) {
        const openTag = next.slice(node.start, node.openEnd)
        const updates: Record<string, string | null> = { 'word-break': 'normal' }
        if (TEXT_TAGS.has(node.tag)) {
          updates.width = width
          updates.height = null
          updates['max-height'] = null
        } else if (!/word-break\s*:/i.test(openTag)) continue
        const replaced = setStyleProperties(openTag, updates)
        if (replaced === openTag) continue
        next = `${next.slice(0, node.start)}${replaced}${next.slice(node.openEnd)}`
      }
    }
  }
  const ordered = [...sectionStyleNodes(next, part)].sort((a, b) => b.start - a.start)
  for (const node of ordered) {
    const openTag = next.slice(node.start, node.openEnd)
    const current = paddingBox(parseStyle(styleAttributeValue(openTag)))
    const updates: Record<string, string | null> = {}
    if (paddingChange) {
      updates.padding = null
      updates['padding-top'] = `${clampSectionPad(patch.paddingTop ?? current.paddingTop)}px`
      updates['padding-right'] = `${clampSectionPad(patch.paddingRight ?? current.paddingRight)}px`
      updates['padding-bottom'] = `${clampSectionPad(patch.paddingBottom ?? current.paddingBottom)}px`
      updates['padding-left'] = `${clampSectionPad(patch.paddingLeft ?? current.paddingLeft)}px`
    }
    if (background !== undefined) updates['background-color'] = background
    let replaced = setStyleProperties(openTag, updates)
    if (background !== undefined && /^<\s*(td|th)\b/i.test(openTag)) replaced = setBgColorAttribute(replaced, background)
    if (replaced === openTag) continue
    next = `${next.slice(0, node.start)}${replaced}${next.slice(node.openEnd)}`
  }
  return next
}

/** Preview-only wrappers so a text run can be edited. Not saved with the email. */
export function emailPreviewWithTextMarkers(html: string): string {
  const runs = listEmailTextRuns(html)
  let next = html
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index]
    if (!run) continue
    const raw = next.slice(run.start, run.end)
    next = `${next.slice(0, run.start)}<span data-email-text="${index}">${raw}</span>${next.slice(run.end)}`
  }
  return next
}

function nodeHasContent(html: string, node: EmailNode): boolean {
  if (node.tag === 'img') return true
  const slice = html.slice(node.start, node.end)
  if (/<img\b/i.test(slice)) return true
  return visibleText(slice).length > 0
}

function imageAlt(html: string, node: EmailNode): string {
  const open = html.slice(node.start, node.openEnd)
  const match = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(open)
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function itemKind(node: EmailNode, html: string): EmailArrangeKind | null {
  if (!node.closed || node.tag === '#root' || node.tag === 'td' || node.tag === 'th') return null
  if (node.tag === 'img') return 'image'
  if (node.tag === 'a') {
    const hasImage = node.children.some((child) => child.tag === 'img')
    if (hasImage && visibleText(html.slice(node.start, node.end)).length < 2) return 'image'
    return null
  }
  if (!nodeHasContent(html, node)) return null
  if (TEXT_TAGS.has(node.tag)) return 'text'
  if (SECTION_TAGS.has(node.tag)) return 'section'
  return null
}

function itemLabel(html: string, node: EmailNode, kind: EmailArrangeKind): string {
  if (kind === 'image') {
    const image = node.tag === 'img' ? node : node.children.find((child) => child.tag === 'img')
    const alt = image ? imageAlt(html, image) : ''
    return alt || 'Image'
  }
  const text = visibleText(html.slice(node.start, node.end))
  if (!text) return kind === 'text' ? 'Text' : 'Section'
  return text.length > 72 ? `${text.slice(0, 72).trim()}…` : text
}

type ArrangeDraft = Omit<EmailArrangeItem, 'part' | 'depth'> & { node: EmailNode }

function collect(html: string, node: EmailNode, items: ArrangeDraft[]) {
  const movable = node.children.flatMap((child) => {
    const kind = itemKind(child, html)
    return kind ? [{ child, kind }] : []
  })
  if (movable.length >= 2) {
    const group = `p${node.start}:${node.tag}`
    for (const entry of movable) {
      items.push({
        kind: entry.kind,
        label: itemLabel(html, entry.child, entry.kind),
        group,
        start: entry.child.start,
        end: entry.child.end,
        openEnd: entry.child.openEnd,
        node: entry.child
      })
    }
  }
  for (const child of node.children) collect(html, child, items)
}

/** Sections, text blocks, and images that have a sibling and can be reordered. */
export function listEmailArrangeItems(html: string): EmailArrangeItem[] {
  if (!html.trim()) return []
  const draft: ArrangeDraft[] = []
  collect(html, buildTree(html), draft)
  const byStart = [...draft].sort((a, b) => a.start - b.start || a.end - b.end)
  const starts = new Set(byStart.map((item) => item.start))
  return byStart.map((item, part) => {
    let depth = 0
    let parent = item.node.parent
    while (parent) {
      if (starts.has(parent.start)) depth += 1
      parent = parent.parent
    }
    return {
      part,
      kind: item.kind,
      label: item.label,
      depth,
      group: item.group,
      start: item.start,
      end: item.end,
      openEnd: item.openEnd
    }
  })
}

function insertOpenAttribute(html: string, openEnd: number, attribute: string): string {
  const end = openEnd - 1
  if (end < 0 || html[end] !== '>') return html
  return `${html.slice(0, end)} ${attribute}${html.slice(end)}`
}

/** Preview-only markers so a section can be highlighted. Not saved with the email. */
export function emailPreviewWithArrangeMarkers(html: string): string {
  const items = listEmailArrangeItems(html)
  let next = html
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (!item) continue
    const open = next.slice(item.start, item.openEnd)
    if (/\bdata-email-part\s*=/i.test(open)) continue
    const group = item.group.replace(/"/g, '')
    next = insertOpenAttribute(
      next,
      item.openEnd,
      `data-email-part="${item.part}" data-email-kind="${item.kind}" data-email-group="${group}"`
    )
  }
  return next
}

function relocateSlice(html: string, start: number, end: number, target: number, place: 'before' | 'after', targetEnd: number): string {
  if (start < 0 || end <= start || end > html.length) return html
  if (target >= start && target < end) return html
  const slice = html.slice(start, end)
  const without = html.slice(0, start) + html.slice(end)
  let at = place === 'after' ? targetEnd : target
  if (start < at) at -= slice.length
  if (at < 0 || at > without.length) return html
  return without.slice(0, at) + slice + without.slice(at)
}

/** Move a listed part before or after another part in the same group. */
export function moveEmailArrangeItemTo(
  html: string,
  fromPart: number,
  toPart: number,
  place?: 'before' | 'after'
): { html: string, part: number } {
  const items = listEmailArrangeItems(html)
  const from = items[fromPart]
  const to = items[toPart]
  if (!from || !to || from.part === to.part || from.group !== to.group) return { html, part: fromPart }
  const dropPlace = place ?? (from.start < to.start ? 'after' : 'before')
  const next = relocateSlice(html, from.start, from.end, to.start, dropPlace, to.end)
  if (next === html) return { html, part: fromPart }
  const movedStart = dropPlace === 'before'
    ? (from.start < to.start ? to.start - (from.end - from.start) : to.start)
    : (from.start < to.start ? to.end - (from.end - from.start) : to.end)
  const again = listEmailArrangeItems(next)
  const found = again.find((item) => item.start === movedStart && item.group === from.group)
  return { html: next, part: found?.part ?? fromPart }
}

export function moveEmailArrangeItemBy(html: string, part: number, direction: -1 | 1): { html: string, part: number } {
  const items = listEmailArrangeItems(html)
  const item = items[part]
  if (!item) return { html, part }
  const siblings = items.filter((entry) => entry.group === item.group)
  const index = siblings.findIndex((entry) => entry.part === item.part)
  const target = siblings[index + direction]
  if (!target) return { html, part }
  return moveEmailArrangeItemTo(html, item.part, target.part)
}
