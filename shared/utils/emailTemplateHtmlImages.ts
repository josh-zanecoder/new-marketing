/**
 * Discover / replace `<img>` tags in email-template HTML without requiring users to edit markup.
 */

export type EmailTemplateHtmlImage = {
  /** 0-based order of appearance in the HTML. */
  index: number
  src: string
  tagStart: number
  tagEnd: number
}

const IMG_TAG_RE = /<img\b[^>]*\/?>/gi
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

function readSrcFromTag(tag: string): string {
  const m = tag.match(SRC_ATTR_RE)
  if (!m) return ''
  return m[1] ?? m[2] ?? m[3] ?? ''
}

/** List every `<img>` in document order (includes data-URLs and remote srcs). */
export function listEmailTemplateHtmlImages(html: string): EmailTemplateHtmlImage[] {
  const out: EmailTemplateHtmlImage[] = []
  if (!html) return out
  const re = new RegExp(IMG_TAG_RE.source, 'gi')
  let m: RegExpExecArray | null
  let index = 0
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    out.push({
      index,
      src: readSrcFromTag(tag),
      tagStart: m.index,
      tagEnd: m.index + tag.length
    })
    index += 1
  }
  return out
}

/**
 * Replace only the `src` of the Nth `<img>` (0-based). Other attributes stay intact.
 * Returns the original string unchanged if the index is out of range.
 */
export function replaceEmailTemplateHtmlImageSrc(
  html: string,
  imageIndex: number,
  nextSrc: string
): string {
  const images = listEmailTemplateHtmlImages(html)
  const target = images[imageIndex]
  if (!target) return html

  const tag = html.slice(target.tagStart, target.tagEnd)
  const safeSrc = String(nextSrc ?? '').replace(/"/g, '&quot;')
  let nextTag: string
  if (SRC_ATTR_RE.test(tag)) {
    nextTag = tag.replace(SRC_ATTR_RE, `src="${safeSrc}"`)
  } else {
    nextTag = tag.replace(/^<img\b/i, `<img src="${safeSrc}"`)
  }
  return html.slice(0, target.tagStart) + nextTag + html.slice(target.tagEnd)
}

/** Short label for UI chips (avoids dumping entire base64 into the label). */
export function emailTemplateHtmlImageLabel(src: string, index: number): string {
  const n = index + 1
  const s = (src || '').trim()
  if (!s) return `Image ${n} (no src)`
  if (/^data:image\//i.test(s)) {
    const kind = s.slice(11, s.indexOf(';')).toUpperCase() || 'IMG'
    return `Image ${n} · Embedded ${kind}`
  }
  try {
    const u = new URL(s)
    const file = u.pathname.split('/').filter(Boolean).pop() || u.hostname
    return `Image ${n} · ${file}`
  } catch {
    return `Image ${n}`
  }
}
