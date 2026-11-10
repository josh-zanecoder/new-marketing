/** Visual email blocks. Saved inside an HTML comment so the builder can reopen them. */

export type EmailBlockAlign = 'left' | 'center'

export type EmailBlockBox = {
  x: number
  y: number
  w: number
  h: number
}

export type EmailBlock = EmailBlockBox & (
  | { id: string; type: 'heading'; text: string; align: EmailBlockAlign }
  | { id: string; type: 'text'; text: string; align: EmailBlockAlign }
  | { id: string; type: 'image'; src: string; alt: string; href: string }
  | { id: string; type: 'button'; label: string; href: string; align: EmailBlockAlign }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height: number }
  | { id: string; type: 'html'; html: string }
)

export type EmailBuilderDoc = {
  version: 1
  canvasWidth: number
  canvasHeight: number
  blocks: EmailBlock[]
}

export const EMAIL_CANVAS_MIN_WIDTH = 320
export const EMAIL_CANVAS_MAX_WIDTH = 800
export const EMAIL_CANVAS_MIN_HEIGHT = 320

const BLOCK_SIZE: Record<EmailBlock['type'], { w: number; h: number }> = {
  heading: { w: 520, h: 56 },
  text: { w: 520, h: 96 },
  image: { w: 520, h: 220 },
  button: { w: 180, h: 48 },
  divider: { w: 520, h: 16 },
  spacer: { w: 520, h: 32 },
  html: { w: 552, h: 280 }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const MARKER_RE = /<!--email-builder:([\s\S]*?)-->/

export function newEmailBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `b-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createEmailBlock(
  type: EmailBlock['type'],
  at?: Partial<EmailBlockBox>
): EmailBlock {
  const id = newEmailBlockId()
  const size = BLOCK_SIZE[type]
  const box: EmailBlockBox = {
    x: clampNumber(at?.x, 24, 0, 2000),
    y: clampNumber(at?.y, 24, 0, 4000),
    w: clampNumber(at?.w, size.w, 40, 2000),
    h: clampNumber(at?.h, size.h, 16, 2000)
  }
  switch (type) {
    case 'heading':
      return { ...box, id, type, text: 'Heading', align: 'left' }
    case 'text':
      return { ...box, id, type, text: 'Write your message here.', align: 'left' }
    case 'image':
      return { ...box, id, type, src: '', alt: '', href: '' }
    case 'button':
      return { ...box, id, type, label: 'Learn more', href: 'https://', align: 'center' }
    case 'divider':
      return { ...box, id, type }
    case 'spacer':
      return { ...box, id, type, height: box.h }
    case 'html':
      return { ...box, id, type, html: '' }
  }
}

export function defaultEmailBuilderDoc(): EmailBuilderDoc {
  const heading = createEmailBlock('heading', { x: 40, y: 36, w: 520, h: 56 })
  const text = createEmailBlock('text', { x: 40, y: 110, w: 520, h: 80 })
  const image = createEmailBlock('image', { x: 40, y: 210, w: 520, h: 220 })
  const button = createEmailBlock('button', { x: 210, y: 460, w: 180, h: 48 })
  if (heading.type === 'heading') heading.text = 'Welcome'
  if (text.type === 'text') text.text = 'Add a short note, then drop in this week’s image.'
  if (heading.type === 'heading') heading.align = 'center'
  if (text.type === 'text') text.align = 'center'
  return {
    version: 1,
    canvasWidth: 600,
    canvasHeight: 720,
    blocks: [heading, text, image, button]
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;')
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function blockInnerHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<h1 style="margin:0;font-size:28px;line-height:1.3;font-weight:700;color:#1e293b;text-align:${block.align};">${textToHtml(block.text)}</h1>`
    case 'text':
      return `<p style="margin:0;font-size:16px;line-height:1.6;color:#334155;text-align:${block.align};">${textToHtml(block.text)}</p>`
    case 'image': {
      if (!block.src.trim()) {
        return `<p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;">Image</p>`
      }
      const img = `<img src="${escapeAttr(block.src.trim())}" alt="${escapeAttr(block.alt)}" width="${Math.round(block.w)}" height="${Math.round(block.h)}" style="display:block;width:100%;height:100%;object-fit:contain;border:0;" />`
      const href = block.href.trim()
      return href ? `<a href="${escapeAttr(href)}" style="text-decoration:none;">${img}</a>` : img
    }
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" align="${block.align === 'center' ? 'center' : 'left'}" style="margin:0;"><tr><td style="border-radius:8px;background:#1e293b;"><a href="${escapeAttr(block.href.trim() || '#')}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${textToHtml(block.label || 'Button')}</a></td></tr></table>`
    case 'divider':
      return `<div style="height:1px;background:#e2e8f0;line-height:1px;font-size:1px;">&nbsp;</div>`
    case 'spacer':
      return `<div style="height:${Math.max(8, Math.min(120, block.height || 24))}px;line-height:${Math.max(8, Math.min(120, block.height || 24))}px;font-size:1px;">&nbsp;</div>`
    case 'html':
      return block.html
  }
}

export function emailBuilderBodyHtml(doc: EmailBuilderDoc): string {
  const width = clampNumber(doc.canvasWidth, 600, EMAIL_CANVAS_MIN_WIDTH, EMAIL_CANVAS_MAX_WIDTH)
  const height = clampNumber(doc.canvasHeight, 720, EMAIL_CANVAS_MIN_HEIGHT, 4000)
  const placed = doc.blocks
    .map(
      (block) =>
        `<div style="position:absolute;left:${Math.round(block.x)}px;top:${Math.round(block.y)}px;width:${Math.round(block.w)}px;height:${Math.round(block.h)}px;overflow:hidden;">${blockInnerHtml(block)}</div>`
    )
    .join('')
  return `<!--email-builder:${encodeURIComponent(JSON.stringify(doc))}--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ef;"><tr><td align="center" style="padding:24px 12px;"><div style="position:relative;width:${width}px;max-width:100%;height:${height}px;background:#ffffff;border-radius:12px;overflow:hidden;">${placed}</div></td></tr></table>`
}

function isAlign(value: unknown): value is EmailBlockAlign {
  return value === 'left' || value === 'center'
}

function boxFromRaw(raw: Record<string, unknown>, type: EmailBlock['type'], index: number): EmailBlockBox {
  const size = BLOCK_SIZE[type]
  const hasY = raw.y !== undefined && raw.y !== null && raw.y !== ''
  return {
    x: clampNumber(raw.x, 24, 0, 2000),
    y: clampNumber(raw.y, hasY ? 24 : 24 + index * (size.h + 16), 0, 4000),
    w: clampNumber(raw.w, size.w, 40, 2000),
    h: clampNumber(raw.h, size.h, 16, 2000)
  }
}

function parseBlock(raw: unknown, index: number): EmailBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const block = raw as Record<string, unknown>
  const id = typeof block.id === 'string' && block.id.trim() ? block.id : newEmailBlockId()
  const type = block.type
  if (type !== 'heading' && type !== 'text' && type !== 'image' && type !== 'button' && type !== 'divider' && type !== 'spacer' && type !== 'html') {
    return null
  }
  const box = boxFromRaw(block, type, index)
  if (type === 'heading' || type === 'text') {
    return {
      ...box,
      id,
      type,
      text: typeof block.text === 'string' ? block.text : '',
      align: isAlign(block.align) ? block.align : 'left'
    }
  }
  if (type === 'image') {
    return {
      ...box,
      id,
      type,
      src: typeof block.src === 'string' ? block.src : '',
      alt: typeof block.alt === 'string' ? block.alt : '',
      href: typeof block.href === 'string' ? block.href : ''
    }
  }
  if (type === 'button') {
    return {
      ...box,
      id,
      type,
      label: typeof block.label === 'string' ? block.label : 'Button',
      href: typeof block.href === 'string' ? block.href : '',
      align: isAlign(block.align) ? block.align : 'center'
    }
  }
  if (type === 'divider') return { ...box, id, type }
  if (type === 'spacer') {
    const height = Number(block.height)
    return { ...box, id, type, height: Number.isFinite(height) ? height : box.h }
  }
  return { ...box, id, type: 'html', html: typeof block.html === 'string' ? block.html : '' }
}

export function parseEmailBuilderDoc(html: string): EmailBuilderDoc | null {
  const match = html.match(MARKER_RE)
  if (!match?.[1]) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as {
      version?: unknown
      canvasWidth?: unknown
      canvasHeight?: unknown
      blocks?: unknown
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.blocks)) return null
    const blocks = parsed.blocks
      .map((block, index) => parseBlock(block, index))
      .filter((block): block is EmailBlock => Boolean(block))
    const bottom = blocks.reduce((max, block) => Math.max(max, block.y + block.h + 40), EMAIL_CANVAS_MIN_HEIGHT)
    return {
      version: 1,
      canvasWidth: clampNumber(parsed.canvasWidth, 600, EMAIL_CANVAS_MIN_WIDTH, EMAIL_CANVAS_MAX_WIDTH),
      canvasHeight: clampNumber(parsed.canvasHeight, bottom, EMAIL_CANVAS_MIN_HEIGHT, 4000),
      blocks
    }
  } catch {
    return null
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}

function visibleText(inner: string): string {
  return decodeHtmlEntities(
    inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function isTrackingPixel(tag: string): boolean {
  const width = Number(htmlAttr(tag, 'width'))
  const height = Number(htmlAttr(tag, 'height'))
  return (Number.isFinite(width) && width > 0 && width <= 2) || (Number.isFinite(height) && height > 0 && height <= 2)
}

function looksLikeButton(markup: string, text: string): boolean {
  if (!text || text.length > 40 || text.includes('\n')) return false
  return /background(?:-color)?\s*:|border-radius\s*:|display\s*:\s*inline-block|btn|button/i.test(markup)
}

/**
 * Turn a saved email into separate canvas blocks (image, heading, text, button)
 * instead of one locked HTML slab.
 */
export function blocksFromImportedHtml(html: string): EmailBlock[] {
  const source = html
    .replace(/<!--email-builder:[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
  const found: Array<{ index: number; block: EmailBlock }> = []
  const seen = new Set<string>()
  const contentWidth = 552

  function push(index: number, block: EmailBlock) {
    found.push({ index, block })
  }

  const partRe = /<img\b[^>]*>|<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>|<p\b[^>]*>[\s\S]*?<\/p>|<a\b[^>]*>[\s\S]*?<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = partRe.exec(source))) {
    const raw = match[0]
    if (/^<img\b/i.test(raw)) {
      const src = htmlAttr(raw, 'src')
      if (!src || isTrackingPixel(raw) || seen.has(`img:${src}`)) continue
      seen.add(`img:${src}`)
      const block = createEmailBlock('image', { w: contentWidth, h: 200 })
      if (block.type !== 'image') continue
      block.src = src
      block.alt = htmlAttr(raw, 'alt')
      push(match.index, block)
      continue
    }
    if (/^<a\b/i.test(raw)) {
      const imageTag = raw.match(/<img\b[^>]*>/i)?.[0]
      if (imageTag) {
        const src = htmlAttr(imageTag, 'src')
        if (!src || isTrackingPixel(imageTag) || seen.has(`img:${src}`)) continue
        seen.add(`img:${src}`)
        const block = createEmailBlock('image', { w: contentWidth, h: 200 })
        if (block.type !== 'image') continue
        block.src = src
        block.alt = htmlAttr(imageTag, 'alt')
        block.href = htmlAttr(raw, 'href')
        push(match.index, block)
        continue
      }
      const text = visibleText(raw)
      if (!looksLikeButton(raw, text) || seen.has(`text:${text}`)) continue
      seen.add(`text:${text}`)
      const block = createEmailBlock('button', { w: 200, h: 48 })
      if (block.type !== 'button') continue
      block.label = text
      block.href = htmlAttr(raw, 'href') || 'https://'
      push(match.index, block)
      continue
    }
    const text = visibleText(raw)
    if (!text || seen.has(`text:${text}`)) continue
    seen.add(`text:${text}`)
    if (/^<h/i.test(raw)) {
      const block = createEmailBlock('heading', {
        w: contentWidth,
        h: Math.min(140, 36 + Math.ceil(text.length / 26) * 28)
      })
      if (block.type !== 'heading') continue
      block.text = text
      push(match.index, block)
      continue
    }
    const lines = Math.max(2, Math.ceil(text.length / 48))
    const block = createEmailBlock('text', {
      w: contentWidth,
      h: Math.min(240, 20 + lines * 22)
    })
    if (block.type !== 'text') continue
    block.text = text
    push(match.index, block)
  }

  const openRe = /<t[dh]\b([^>]*)>/gi
  let cell: RegExpExecArray | null
  while ((cell = openRe.exec(source))) {
    const start = cell.index + cell[0].length
    const rest = source.slice(start)
    const nextOpen = rest.search(/<t[dh]\b/i)
    const nextClose = rest.search(/<\/t[dh]>/i)
    if (nextClose < 0 || (nextOpen >= 0 && nextOpen < nextClose)) continue
    const inner = rest.slice(0, nextClose)
    if (/<p\b|<h[1-6]\b|<img\b|<a\b/i.test(inner)) continue
    const text = visibleText(inner)
    if (!text || text.length < 2 || seen.has(`text:${text}`)) continue
    if ([...seen].some((entry) => entry.startsWith('text:') && (entry.slice(5).includes(text) || text.includes(entry.slice(5))))) {
      continue
    }
    seen.add(`text:${text}`)
    const markup = `${cell[0]}${inner}`
    if (looksLikeButton(markup, text)) {
      const block = createEmailBlock('button', { w: 200, h: 48 })
      if (block.type !== 'button') continue
      block.label = text
      block.href = htmlAttr(inner, 'href') || 'https://'
      push(cell.index, block)
      continue
    }
    const lines = Math.max(2, Math.ceil(text.length / 48))
    const block = createEmailBlock('text', {
      w: contentWidth,
      h: Math.min(240, 20 + lines * 22)
    })
    if (block.type !== 'text') continue
    block.text = text
    push(cell.index, block)
  }

  let y = 24
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ block }) => {
      const placed = {
        ...block,
        x: block.type === 'button' ? Math.max(24, Math.round((600 - block.w) / 2) - 24) : 24,
        y,
        w: block.type === 'button' ? block.w : contentWidth
      }
      y += placed.h + 16
      return placed
    })
}

/** Reopen a builder document, or split imported HTML into movable parts. */
export function emailBuilderDocFromHtml(html: string): EmailBuilderDoc {
  const trimmed = html.trim()
  if (!trimmed) return defaultEmailBuilderDoc()
  const parsed = parseEmailBuilderDoc(trimmed)
  if (parsed) return parsed
  const blocks = blocksFromImportedHtml(trimmed)
  if (!blocks.length) {
    const htmlBlock = createEmailBlock('html', { x: 24, y: 24, w: 552, h: 640 })
    if (htmlBlock.type !== 'html') return defaultEmailBuilderDoc()
    htmlBlock.html = trimmed
    return { version: 1, canvasWidth: 600, canvasHeight: 720, blocks: [htmlBlock] }
  }
  const bottom = blocks.reduce((max, block) => Math.max(max, block.y + block.h), EMAIL_CANVAS_MIN_HEIGHT)
  return {
    version: 1,
    canvasWidth: 600,
    canvasHeight: Math.max(EMAIL_CANVAS_MIN_HEIGHT, bottom + 48),
    blocks
  }
}
