/**
 * Preview-only CSS to activate mobile layout inside iframes (Beefree / similar).
 * Not included in saved/exported HTML.
 *
 * Strategy: preserve the imported template's own @media block and add a small
 * unconditional reinforce layer only when the preview iframe is already mobile-width.
 * Flattening @media into duplicate rules caused card columns to stay side-by-side.
 */

/** Minimal structural fallback when HTML has no extractable @media blocks. */
export const BEEFREE_MOBILE_FALLBACK_CSS = `
<style id="eb-preview-mobile-fallback">
  .image_block div.fullWidth { max-width: 100% !important; }
  .row-content { width: 100% !important; max-width: 100% !important; }
  .stack .column { width: 100% !important; display: block !important; box-sizing: border-box !important; }
  .mobile_hide,
  .mobile_hide table {
    min-height: 0 !important; max-height: 0 !important; max-width: 0 !important;
    display: none !important; overflow: hidden !important; font-size: 0 !important;
  }
  .desktop_hide,
  .desktop_hide table {
    display: table !important; max-height: none !important; overflow: visible !important;
    mso-hide: none !important;
  }
  .reverse { display: table !important; width: 100% !important; }
  .reverse .column.first { display: table-footer-group !important; }
  .reverse .column.last { display: table-header-group !important; }
  table.row,
  .nl-container,
  .row-content.stack { width: 100% !important; max-width: 100% !important; }
  table[width="760"], .row-content[width="760"] { width: 100% !important; max-width: 100% !important; }
  img { max-width: 100% !important; height: auto !important; }
</style>`

/**
 * Unconditional reinforce — injected only when the preview iframe is mobile-width.
 * Beats inline `width:760px` / `display:none` and mirrors Beefree `.stack .column` stacking.
 */
export const MOBILE_PREVIEW_REINFORCE_CSS = `
<style id="eb-preview-mobile-reinforce">
  .nl-container,
  table.row,
  .row-content,
  .row-content.stack,
  table[width="760"],
  .row-content[width="760"] {
    width: 100% !important;
    max-width: 100% !important;
  }
  .stack .column {
    width: 100% !important;
    max-width: 100% !important;
    display: block !important;
    box-sizing: border-box !important;
  }
  tr.reverse {
    display: table !important;
    width: 100% !important;
  }
  tr.reverse .column.first {
    display: table-footer-group !important;
  }
  tr.reverse .column.last {
    display: table-header-group !important;
  }
  table.row.mobile_hide,
  table.row.mobile_hide > tbody > tr > td,
  table.row.mobile_hide .row-content,
  table.heading_block.mobile_hide,
  table.paragraph_block.mobile_hide,
  table.image_block.mobile_hide,
  .mobile_hide:not(.desktop_hide),
  .mobile_hide:not(.desktop_hide) table {
    min-height: 0 !important;
    max-height: 0 !important;
    max-width: 0 !important;
    display: none !important;
    overflow: hidden !important;
    font-size: 0 !important;
    visibility: hidden !important;
  }
  table.row.desktop_hide,
  table.row.desktop_hide > tbody > tr > td,
  table.row.desktop_hide .row-content,
  table.row.desktop_hide .row-content.stack,
  table.row.desktop_hide table,
  table.row.desktop_hide .heading_block,
  table.row.desktop_hide .paragraph_block,
  table.row.desktop_hide .image_block,
  table.row.desktop_hide .divider_block,
  table.row.desktop_hide .button_block,
  table.heading_block.desktop_hide,
  table.paragraph_block.desktop_hide,
  table.image_block.desktop_hide,
  table.button_block.desktop_hide,
  table.divider_block.desktop_hide {
    display: table !important;
    max-height: none !important;
    max-width: none !important;
    overflow: visible !important;
    visibility: visible !important;
    mso-hide: none !important;
  }
  .image_block img {
    max-width: 100% !important;
    height: auto !important;
  }
</style>`

export function stripAllViewportMeta(html: string): string {
  return html.replace(/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/gi, '')
}

export type ParsedMediaBlock = {
  breakpoint: number
  content: string
}

/** Read @media (max-width: Npx) blocks with balanced-brace parsing (handles nested rules). */
export function parseMaxWidthMediaBlocks(css: string): ParsedMediaBlock[] {
  const blocks: ParsedMediaBlock[] = []
  let index = 0

  while (index < css.length) {
    const mediaIndex = css.indexOf('@media', index)
    if (mediaIndex === -1) break

    const braceStart = css.indexOf('{', mediaIndex)
    if (braceStart === -1) break

    const header = css.slice(mediaIndex, braceStart)
    const maxWidthMatch = header.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/i)
    if (!maxWidthMatch) {
      index = braceStart + 1
      continue
    }

    const contentStart = braceStart + 1
    let depth = 1
    let cursor = contentStart
    while (cursor < css.length && depth > 0) {
      const char = css[cursor]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      cursor += 1
    }

    if (depth !== 0) break

    const content = css.slice(contentStart, cursor - 1).trim()
    const breakpoint = Number.parseFloat(maxWidthMatch[1] ?? '')
    if (Number.isFinite(breakpoint) && content) {
      blocks.push({ breakpoint, content })
    }

    index = cursor
  }

  return blocks
}

export function collectStyleTagCss(html: string): string[] {
  const chunks: string[] = []
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1]?.trim()
    if (css) chunks.push(css)
  }
  return chunks
}

/** Prefix flat @media rules (kept for tests / optional tooling — not used in iframe preview). */
export function scopeFlatCssRulesToMobilePreview(css: string): string {
  return css
    .split('}')
    .map((part) => part.trim())
    .filter((part) => part.includes('{'))
    .map((part) => {
      const openBrace = part.indexOf('{')
      const selectors = part.slice(0, openBrace).trim()
      const body = part.slice(openBrace)
      if (!selectors || selectors.startsWith('@')) {
        return `${selectors}${body}}`
      }
      const prefixed = selectors
        .split(',')
        .map((selector) => {
          const trimmed = selector.trim()
          if (!trimmed || trimmed.startsWith('html.eb-mobile-preview')) return trimmed
          return `html.eb-mobile-preview ${trimmed}`
        })
        .join(', ')
      return `${prefixed}${body}}`
    })
    .join('\n\n')
}

/**
 * Flatten matching @media rules into unconditional CSS.
 * @deprecated Prefer native @media + {@link MOBILE_PREVIEW_REINFORCE_CSS} in iframe preview.
 */
export function extractMobileMediaRulesAsFlatCss(html: string, previewWidth: number): string {
  const flatRules: string[] = []

  for (const css of collectStyleTagCss(html)) {
    for (const block of parseMaxWidthMediaBlocks(css)) {
      if (previewWidth > block.breakpoint) continue
      flatRules.push(scopeFlatCssRulesToMobilePreview(block.content))
    }
  }

  if (flatRules.length === 0) return ''
  return `<style id="eb-preview-mobile-extracted">\n${flatRules.join('\n\n')}\n</style>`
}

function htmlHasMobileMediaRules(html: string): boolean {
  return collectStyleTagCss(html).some((css) => parseMaxWidthMediaBlocks(css).length > 0)
}

/**
 * Build preview-only CSS for mobile iframes.
 * Keeps the template's @media block intact; adds a small unconditional reinforce layer.
 */
export function buildMobilePreviewActivation(html: string, previewWidth: number): string {
  const breakpoint = parseMaxWidthMediaBlocks(collectStyleTagCss(html).join('\n'))
    .map((block) => block.breakpoint)
    .reduce((max, value) => Math.max(max, value), 0)

  const effectiveBreakpoint = breakpoint > 0 ? breakpoint : 780
  if (previewWidth > effectiveBreakpoint) return ''

  const reinforce = MOBILE_PREVIEW_REINFORCE_CSS
  if (htmlHasMobileMediaRules(html)) {
    return reinforce
  }
  return `${BEEFREE_MOBILE_FALLBACK_CSS}\n${reinforce}`
}
