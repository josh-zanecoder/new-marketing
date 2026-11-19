import { EMAIL_IMAGE_ROW_COUNTS, type EmailImageRowCount } from '../constants/emailImageRow'
import type { EmailImageBesideSide } from './emailImageBesideZone'

const MAX_IMAGES_IN_ROW = EMAIL_IMAGE_ROW_COUNTS[EMAIL_IMAGE_ROW_COUNTS.length - 1]!

/**
 * Insert a new image src beside a partner inside an existing horizontal row.
 * Returns null when the row is already full (max 4) or the partner index is invalid.
 */
export function insertSrcBesideInEmailImageRow(params: {
  existingSrcs: string[]
  partnerIndex: number
  newSrc: string
  side: EmailImageBesideSide
  maxCount?: number
}): { srcs: string[]; count: EmailImageRowCount } | null {
  const maxCount = params.maxCount ?? MAX_IMAGES_IN_ROW
  const existing = params.existingSrcs.map((src) => String(src || ''))
  if (existing.length < 1 || existing.length >= maxCount) return null
  if (params.partnerIndex < 0 || params.partnerIndex >= existing.length) return null

  const insertAt = params.side === 'left' ? params.partnerIndex : params.partnerIndex + 1
  const srcs = [
    ...existing.slice(0, insertAt),
    String(params.newSrc || ''),
    ...existing.slice(insertAt)
  ]
  if (srcs.length < 2 || srcs.length > maxCount) return null
  if (!(EMAIL_IMAGE_ROW_COUNTS as readonly number[]).includes(srcs.length)) return null
  return { srcs, count: srcs.length as EmailImageRowCount }
}

/** Build src list for a brand-new 2-image row from one partner + one dropped image. */
export function buildTwoImageRowSrcs(
  partnerSrc: string,
  droppedSrc: string,
  side: EmailImageBesideSide
): string[] {
  return side === 'left' ? [droppedSrc, partnerSrc] : [partnerSrc, droppedSrc]
}
