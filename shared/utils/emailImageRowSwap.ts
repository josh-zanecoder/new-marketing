import { EMAIL_IMAGE_ROW_ATTR, EMAIL_IMAGE_ROW_CELL_ATTR } from '../constants/emailImageRow'

/**
 * Swap two image-row cells by index (0-based) inside the first matching row.
 * Used when the builder rearranges images within the same horizontal row.
 */
export function swapEmailImageRowCells(html: string, fromIndex: number, toIndex: number): string {
  if (!html || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return html

  const tableRe = new RegExp(
    `<table\\b[^>]*\\b${EMAIL_IMAGE_ROW_ATTR}\\b[^>]*>[\\s\\S]*?<\\/table>`,
    'i'
  )
  const match = tableRe.exec(html)
  if (!match || match.index == null) return html

  const tableHtml = match[0]
  const cellRe = new RegExp(
    `<td\\b[^>]*\\b${EMAIL_IMAGE_ROW_CELL_ATTR}\\b[^>]*>[\\s\\S]*?<\\/td>`,
    'gi'
  )
  const cells = tableHtml.match(cellRe)
  if (!cells || fromIndex >= cells.length || toIndex >= cells.length) return html

  const nextCells = [...cells]
  const tmp = nextCells[fromIndex]!
  nextCells[fromIndex] = nextCells[toIndex]!
  nextCells[toIndex] = tmp

  let cellIdx = 0
  const nextTable = tableHtml.replace(cellRe, () => nextCells[cellIdx++]!)
  return html.slice(0, match.index) + nextTable + html.slice(match.index + tableHtml.length)
}

/** Collect image `src` values from the first image-row table (left → right). */
export function listEmailImageRowSrcs(html: string): string[] {
  const tableRe = new RegExp(
    `<table\\b[^>]*\\b${EMAIL_IMAGE_ROW_ATTR}\\b[^>]*>[\\s\\S]*?<\\/table>`,
    'i'
  )
  const match = tableRe.exec(html)
  if (!match) return []
  return [...match[0].matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? ''
  )
}
