/**
 * Email-safe horizontal image placement (left / center / right).
 * Absolute drag offsets are stripped by clients — use margins instead.
 */

import {
  EMAIL_IMAGE_ALIGN_ATTR,
  EMAIL_IMAGE_ALIGNS,
  type EmailImageAlign
} from '../constants/emailImageAlign'
import { listEmailTemplateHtmlImages } from './emailTemplateHtmlImages'

function parseStyleDeclarations(style: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of style.split(';')) {
    const splitAt = part.indexOf(':')
    if (splitAt === -1) continue
    const key = part.slice(0, splitAt).trim().toLowerCase()
    const value = part.slice(splitAt + 1).trim()
    if (key) map.set(key, value)
  }
  return map
}

function serializeStyleDeclarations(style: Map<string, string>): string {
  return [...style.entries()].map(([key, value]) => `${key}: ${value}`).join('; ')
}

function upsertQuotedAttr(tag: string, name: string, value: string): string {
  const safe = value.replace(/"/g, '&quot;')
  const attr = new RegExp(`\\b${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i')
  if (attr.test(tag)) return tag.replace(attr, `${name}="${safe}"`)
  return tag.replace(/\/?>$/, (end) => ` ${name}="${safe}"${end}`)
}

function rewriteImageTag(tag: string, style: Map<string, string>): string {
  const serialized = serializeStyleDeclarations(style)
  if (!serialized) return tag.replace(/\s*\bstyle\s*=\s*(?:"[^"]*"|'[^']*')/i, '')
  return upsertQuotedAttr(tag, 'style', serialized)
}

function isEmailImageAlign(value: string): value is EmailImageAlign {
  return (EMAIL_IMAGE_ALIGNS as readonly string[]).includes(value)
}

/** Apply email-safe left/center/right margins on an image style map. */
export function applyEmailImageAlignToStyle(
  style: Map<string, string>,
  align: EmailImageAlign
): void {
  // Drop shorthand so margin-left/right are not overridden by `margin: 0 auto`.
  style.delete('margin')
  style.set('display', style.get('display') || 'block')
  if (align === 'center') {
    style.set('margin-left', 'auto')
    style.set('margin-right', 'auto')
  } else if (align === 'right') {
    style.set('margin-left', 'auto')
    style.set('margin-right', '0')
  } else {
    style.set('margin-left', '0')
    style.set('margin-right', 'auto')
  }
}

function readWidthPx(tag: string, style: Map<string, string>): number | null {
  const fromStyle = /^(\d+(?:\.\d+)?)px$/i.exec((style.get('width') || '').trim())?.[1]
  if (fromStyle) return Number(fromStyle)
  const attr = /\bwidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  const raw = (attr?.[1] ?? attr?.[2] ?? attr?.[3] ?? '').trim()
  const px = /^(\d+(?:\.\d+)?)(?:px)?$/i.exec(raw)?.[1]
  return px ? Number(px) : null
}

function isFluidWidth(tag: string, style: Map<string, string>): boolean {
  const styleWidth = (style.get('width') || '').trim().toLowerCase()
  if (styleWidth === '100%') return true
  const attr = /\bwidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  const raw = (attr?.[1] ?? attr?.[2] ?? attr?.[3] ?? '').trim().toLowerCase()
  return raw === '100%'
}

/**
 * Full-bleed images cannot show left/center/right. Lock to a fixed width so
 * alignment is visible (and still email-safe).
 */
export function resolveEmailImageAlignWidthPx(
  tag: string,
  style: Map<string, string>,
  contentWidthPx = 600
): number | null {
  const current = readWidthPx(tag, style)
  if (!isFluidWidth(tag, style) && current != null && current > 0 && current < contentWidthPx - 8) {
    return null
  }
  const column = Math.max(160, Math.round(contentWidthPx))
  if (current != null && current > 0 && current < column) return Math.round(current)
  return Math.max(120, Math.round(column * 0.5))
}

function inferAlignFromStyle(style: Map<string, string>): EmailImageAlign {
  const ml = (style.get('margin-left') || '').trim().toLowerCase()
  const mr = (style.get('margin-right') || '').trim().toLowerCase()
  if (ml === 'auto' && mr === 'auto') return 'center'
  if (ml === 'auto') return 'right'
  return 'left'
}

function readAlignFromTag(tag: string): EmailImageAlign {
  const attr = new RegExp(
    `\\b${EMAIL_IMAGE_ALIGN_ATTR}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  ).exec(tag)
  const raw = (attr?.[1] ?? attr?.[2] ?? attr?.[3] ?? '').trim().toLowerCase()
  if (isEmailImageAlign(raw)) return raw
  const styleMatch = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const style = parseStyleDeclarations(styleMatch?.[1] ?? styleMatch?.[2] ?? '')
  return inferAlignFromStyle(style)
}

/** Current horizontal align for the Nth `<img>` (defaults to left). */
export function readEmailTemplateHtmlImageAlign(
  html: string,
  imageIndex: number
): EmailImageAlign {
  const target = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!target) return 'left'
  return readAlignFromTag(html.slice(target.tagStart, target.tagEnd))
}

/**
 * Set left / center / right placement for an image using margins that survive
 * inbox clients (no absolute positioning). Fluid `width:100%` images are locked
 * to a fixed width first so alignment is visible.
 */
export function updateEmailTemplateHtmlImageAlign(
  html: string,
  imageIndex: number,
  align: EmailImageAlign,
  options?: { contentWidthPx?: number }
): string {
  if (!isEmailImageAlign(align)) return html
  const target = listEmailTemplateHtmlImages(html)[imageIndex]
  if (!target) return html
  const tag = html.slice(target.tagStart, target.tagEnd)
  const styleMatch = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  const style = parseStyleDeclarations(styleMatch?.[1] ?? styleMatch?.[2] ?? '')
  const lockWidth = resolveEmailImageAlignWidthPx(
    tag,
    style,
    options?.contentWidthPx ?? 600
  )
  if (lockWidth != null) {
    style.set('width', `${lockWidth}px`)
    style.set('max-width', '100%')
    if (!style.has('height') || style.get('height') === 'auto') style.set('height', 'auto')
  }
  applyEmailImageAlignToStyle(style, align)
  let nextTag = rewriteImageTag(tag, style)
  nextTag = upsertQuotedAttr(nextTag, EMAIL_IMAGE_ALIGN_ATTR, align)
  // HTML align helps older clients (Outlook) honor horizontal placement.
  nextTag = upsertQuotedAttr(nextTag, 'align', align)
  if (lockWidth != null) {
    nextTag = upsertQuotedAttr(nextTag, 'width', String(lockWidth))
    nextTag = nextTag.replace(/\s*\bheight\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
  }
  return html.slice(0, target.tagStart) + nextTag + html.slice(target.tagEnd)
}

/** Re-apply stored align after a width/height resize so placement does not jump to the left. */
export function preserveEmailTemplateHtmlImageAlign(
  html: string,
  imageIndex: number,
  align: EmailImageAlign
): string {
  return updateEmailTemplateHtmlImageAlign(html, imageIndex, align)
}
