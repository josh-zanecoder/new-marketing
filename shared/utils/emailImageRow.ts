import {
  EMAIL_IMAGE_ROW_ALIGN,
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_COUNTS,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_ROW_SPACING_MAX_PX,
  EMAIL_IMAGE_ROW_SPACING_MIN_PX,
  EMAIL_IMAGE_ROW_VALIGN,
  type EmailImageRowAlign,
  type EmailImageRowCount,
  type EmailImageRowVAlign
} from '../constants/emailImageRow'

const TABLE_ATTRS = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'

const DEFAULT_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">' +
      '<rect width="640" height="240" fill="#e2e8f0"/>' +
      '<text x="320" y="125" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="18">Image</text>' +
      '</svg>'
  )

export type EmailImageRowOptions = {
  count: EmailImageRowCount
  srcs?: Array<string | null | undefined>
  spacingPx?: number
  align?: EmailImageRowAlign
  valign?: EmailImageRowVAlign
  placeholderSrc?: string
}

function clampSpacing(value: number | undefined): number {
  const n = Number.isFinite(value) ? Math.round(value as number) : EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX
  return Math.max(EMAIL_IMAGE_ROW_SPACING_MIN_PX, Math.min(EMAIL_IMAGE_ROW_SPACING_MAX_PX, n))
}

function normalizeAlign(value: string | undefined): EmailImageRowAlign {
  return (EMAIL_IMAGE_ROW_ALIGN as readonly string[]).includes(value || '')
    ? (value as EmailImageRowAlign)
    : 'center'
}

function normalizeValign(value: string | undefined): EmailImageRowVAlign {
  return (EMAIL_IMAGE_ROW_VALIGN as readonly string[]).includes(value || '')
    ? (value as EmailImageRowVAlign)
    : 'top'
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function imageTag(src: string): string {
  const safe = escapeAttr(src)
  return (
    `<img src="${safe}" alt="" style="display:block;width:100%;max-width:100%;height:auto;border:0;margin:0 auto;" />`
  )
}

function cellHtml(
  percent: number,
  src: string,
  spacingPx: number,
  align: EmailImageRowAlign,
  valign: EmailImageRowVAlign
): string {
  const width = `${Math.round(percent * 10000) / 10000}%`
  const pad = `${spacingPx}px`
  return (
    `<td ${EMAIL_IMAGE_ROW_CELL_ATTR} width="${width}" valign="${valign}" align="${align}" ` +
    `style="width:${width};padding:${pad};vertical-align:${valign};text-align:${align}">` +
    imageTag(src) +
    '</td>'
  )
}

/** Email-safe table with N side-by-side image columns (no overlapping floats). */
export function emailImageRowHtml(options: EmailImageRowOptions): string {
  const count = EMAIL_IMAGE_ROW_COUNTS.includes(options.count) ? options.count : 2
  const spacingPx = clampSpacing(options.spacingPx)
  const align = normalizeAlign(options.align)
  const valign = normalizeValign(options.valign)
  const placeholder = options.placeholderSrc || DEFAULT_PLACEHOLDER
  const percent = 100 / count
  const cells = Array.from({ length: count }, (_, index) => {
    const src = String(options.srcs?.[index] || '').trim() || placeholder
    return cellHtml(percent, src, spacingPx, align, valign)
  }).join('')
  return (
    `<table ${EMAIL_IMAGE_ROW_ATTR}="${count}" ` +
    `data-email-image-spacing="${spacingPx}" ` +
    `data-email-image-align="${align}" ` +
    `data-email-image-valign="${valign}" ` +
    `${TABLE_ATTRS} ` +
    `style="width:100%;border-collapse:collapse;table-layout:fixed">` +
    `<tr>${cells}</tr></table>`
  )
}

/** True when the open tag belongs to a side-by-side image row. */
export function isEmailImageRowOpenTag(openTag: string): boolean {
  return new RegExp(`\\b${EMAIL_IMAGE_ROW_ATTR}\\b`, 'i').test(openTag)
}

/**
 * Patch every image-row cell's padding / align / valign from traits.
 * Leaves markup alone when no image-row tables are present.
 */
export function updateEmailImageRowLayout(
  html: string,
  patch: { spacingPx?: number; align?: EmailImageRowAlign; valign?: EmailImageRowVAlign }
): string {
  if (!html || !isEmailImageRowOpenTag(html)) return html
  const spacingPx = patch.spacingPx == null ? null : clampSpacing(patch.spacingPx)
  const align = patch.align == null ? null : normalizeAlign(patch.align)
  const valign = patch.valign == null ? null : normalizeValign(patch.valign)
  if (spacingPx == null && align == null && valign == null) return html

  const cellRe = new RegExp(`<td\\b[^>]*\\b${EMAIL_IMAGE_ROW_CELL_ATTR}\\b[^>]*>`, 'gi')
  return html.replace(cellRe, (openTag) => {
    let next = openTag
    if (align) {
      next = /\balign\s*=/.test(next)
        ? next.replace(/\balign\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `align="${align}"`)
        : next.replace(/^<td\b/i, `<td align="${align}"`)
      next = next.replace(/(\sstyle\s*=\s*")([^"]*)"/i, (_m, lead: string, style: string) => {
        const kept = style
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !/^text-align\s*:/i.test(part))
        return `${lead}${[`text-align:${align}`, ...kept].join(';')}"`
      })
    }
    if (valign) {
      next = /\bvalign\s*=/.test(next)
        ? next.replace(/\bvalign\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `valign="${valign}"`)
        : next.replace(/^<td\b/i, `<td valign="${valign}"`)
      next = next.replace(/(\sstyle\s*=\s*")([^"]*)"/i, (_m, lead: string, style: string) => {
        const kept = style
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !/^vertical-align\s*:/i.test(part))
        return `${lead}${[`vertical-align:${valign}`, ...kept].join(';')}"`
      })
    }
    if (spacingPx != null) {
      const pad = `${spacingPx}px`
      next = next.replace(/(\sstyle\s*=\s*")([^"]*)"/i, (_m, lead: string, style: string) => {
        const kept = style
          .split(';')
          .map((part) => part.trim())
          .filter((part) => part && !/^padding\s*:/i.test(part))
        return `${lead}${[`padding:${pad}`, ...kept].join(';')}"`
      })
    }
    return next
  })
}

/**
 * Wrap two or more adjacent `<img>` tags in an email-safe image row.
 * Used when the builder detects stacked photos that should sit side by side.
 */
export function wrapAdjacentImagesInRow(
  imageTags: string[],
  options?: Omit<EmailImageRowOptions, 'count' | 'srcs'>
): string | null {
  const tags = imageTags.map((tag) => tag.trim()).filter(Boolean)
  if (tags.length < 2 || tags.length > 4) return null
  const srcs = tags.map((tag) => {
    const match = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
  })
  return emailImageRowHtml({
    count: tags.length as EmailImageRowCount,
    srcs,
    spacingPx: options?.spacingPx,
    align: options?.align,
    valign: options?.valign,
    placeholderSrc: options?.placeholderSrc
  })
}
