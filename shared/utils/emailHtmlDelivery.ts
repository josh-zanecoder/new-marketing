/**
 * Prepare Beefree-style HTML for email delivery (Brevo → Gmail, etc.).
 *
 * Gmail inserts "⋯" expand toggles when it finds duplicate layouts hidden with
 * `display:none` / `max-height:0` (Beefree `mobile_hide` + `desktop_hide` pairs).
 *
 * Strategy (mobile-safe):
 * - Delete desktop-only duplicates (`mobile_hide` rows/blocks)
 * - Keep mobile duplicates, remove `desktop_hide` class + inline hidden styles
 * - Scrub CSS rules that hide those classes
 *
 * Stored editor HTML is unchanged — this runs only at send time.
 */

const MOBILE_HIDE_CLASS = /\bmobile_hide\b/

function readClassAttr(attrs: string): string {
  const match = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i)
  return match?.[1] ?? ''
}

function classAttrHasMobileHide(attrs: string): boolean {
  return MOBILE_HIDE_CLASS.test(readClassAttr(attrs))
}

function findBalancedCloseTagIndex(html: string, tagName: string, openEnd: number): number {
  const openRe = new RegExp(`<${tagName}\\b`, 'gi')
  const closeRe = new RegExp(`<\\/${tagName}\\s*>`, 'gi')
  let depth = 1
  let pos = openEnd

  while (depth > 0 && pos < html.length) {
    openRe.lastIndex = pos
    closeRe.lastIndex = pos
    const nextOpen = openRe.exec(html)
    const nextClose = closeRe.exec(html)
    if (!nextClose) return -1

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1
      pos = nextOpen.index + nextOpen[0].length
      continue
    }

    depth -= 1
    if (depth === 0) return nextClose.index
    pos = nextClose.index + nextClose[0].length
  }

  return -1
}

function removeTablesMatching(html: string, shouldRemove: (attrs: string) => boolean): string {
  let result = html
  let changed = true

  while (changed) {
    changed = false
    const openRe = /<table\b([^>]*)>/gi
    let match: RegExpExecArray | null

    while ((match = openRe.exec(result)) !== null) {
      if (!shouldRemove(match[1] ?? '')) continue

      const start = match.index
      const openEnd = start + match[0].length
      const closeStart = findBalancedCloseTagIndex(result, 'table', openEnd)
      if (closeStart === -1) continue

      const closeEnd = closeStart + '</table>'.length
      result = result.slice(0, start) + result.slice(closeEnd)
      changed = true
      break
    }
  }

  return result
}

function stripClassToken(html: string, token: string): string {
  const tokenRe = new RegExp(`\\b${token}\\b`, 'g')
  return html.replace(/\bclass\s*=\s*["']([^"']*)["']/gi, (_full, classes: string) => {
    const next = classes.replace(tokenRe, '').replace(/\s+/g, ' ').trim()
    return next ? `class="${next}"` : ''
  })
}

function stripInlineHiddenStylesFromStyleAttr(style: string): string {
  let next = style
  next = next.replace(/mso-hide\s*:\s*all\s*;?/gi, '')
  next = next.replace(/display\s*:\s*none\s*;?/gi, '')
  next = next.replace(/max-height\s*:\s*0(px)?\s*;?/gi, '')
  next = next.replace(/overflow\s*:\s*hidden\s*;?/gi, '')
  next = next.replace(/;\s*;+/g, ';').replace(/^\s*;+|\s*;+$/g, '').trim()
  return next
}

/** Beefree mobile-only rows/blocks use inline mso-hide + display:none + max-height:0. */
function hasBeefreeHiddenInlineStyle(attrs: string): boolean {
  const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)
  if (!styleMatch) return false
  const style = styleMatch[1].toLowerCase()
  if (!/display\s*:\s*none/.test(style)) return false
  return /max-height\s*:\s*0/.test(style) || /mso-hide\s*:\s*all/.test(style)
}

function stripInlineHiddenStylesOnBeefreeHiddenElements(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    if (!hasBeefreeHiddenInlineStyle(attrs)) return full
    const nextAttrs = attrs.replace(/\bstyle\s*=\s*["']([^"']*)["']/i, (_m, style: string) => {
      const cleaned = stripInlineHiddenStylesFromStyleAttr(style)
      return cleaned ? ` style="${cleaned}"` : ''
    })
    return `<${tag}${nextAttrs}>`
  })
}

function scrubHiddenRulesFromCss(css: string): string {
  let out = css

  out = out.replace(/\.desktop_hide\s*,\s*[\s\S]*?\.desktop_hide\s+table\s*\{[^}]*\}/gi, '')
  out = out.replace(/\.desktop_hide[^{]*\{[^}]*\}/gi, '')
  out = out.replace(/\.mobile_hide\s*,\s*[\s\S]*?\.mobile_hide\s+table\s*\{[^}]*\}/gi, '')
  out = out.replace(/\.mobile_hide\s*\{[^}]*\}/gi, '')
  out = out.replace(/\.image_block\s+img\+div\s*\{[^}]*\}/gi, '')

  return out
}

function scrubHiddenCssFromStyleTags(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs: string, css: string) => {
    const cleaned = scrubHiddenRulesFromCss(css)
    return `<style${attrs}>${cleaned}</style>`
  })
}

function unwrapNonMsoConditionalMarkers(html: string): string {
  return html
    .replace(/<!--\s*\[if\s+!mso\]\s*><!-->\s*/gi, '')
    .replace(/\s*<!--\s*<!\[endif\]\s*-->/gi, '')
}

function stripEditorMarkers(html: string): string {
  return html.replace(/\sdata-eb-id="[^"]*"/gi, '')
}

export function prepareEmailHtmlForDelivery(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return trimmed

  let out = trimmed
  out = removeTablesMatching(out, classAttrHasMobileHide)
  out = stripClassToken(out, 'desktop_hide')
  out = stripClassToken(out, 'mobile_hide')
  out = stripInlineHiddenStylesOnBeefreeHiddenElements(out)
  out = scrubHiddenCssFromStyleTags(out)
  out = unwrapNonMsoConditionalMarkers(out)
  out = stripEditorMarkers(out)
  return out
}
