import { EMAIL_IMAGE_BESIDE_ZONE_RATIO } from '../constants/emailImageRow'
import { resolveEmailImageBesideSide, type EmailImageBesideSide } from './emailImageBesideZone'

export type EmailImageBesideHitRect = {
  id: string
  left: number
  top: number
  width: number
  height: number
}

/** Map a pointer from the parent page into the canvas iframe viewport. */
export function mapParentPointToFrame(
  parentX: number,
  parentY: number,
  frameRect: { left: number; top: number }
): { x: number; y: number } {
  return {
    x: parentX - frameRect.left,
    y: parentY - frameRect.top
  }
}

/**
 * Pick an image under (or near) the pointer for a side-by-side drop.
 * Inflates the hit box slightly so a drag ghost / green line still counts.
 */
export function findEmailImageBesideHit(
  clientX: number,
  clientY: number,
  rects: EmailImageBesideHitRect[],
  zoneRatio: number = EMAIL_IMAGE_BESIDE_ZONE_RATIO,
  padPx: number = 24
): { id: string; side: EmailImageBesideSide } | null {
  let best: { id: string; side: EmailImageBesideSide; area: number } | null = null
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue
    const left = rect.left - padPx
    const right = rect.left + rect.width + padPx
    const top = rect.top - padPx
    const bottom = rect.top + rect.height + padPx
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) continue
    const side = resolveEmailImageBesideSide(clientX, rect, zoneRatio)
    if (!side) continue
    const area = rect.width * rect.height
    if (!best || area < best.area) best = { id: rect.id, side, area }
  }
  return best ? { id: best.id, side: best.side } : null
}

/**
 * After Grapes stacks a new image above/below another (green insert line),
 * pick that nearby photo as the side-by-side partner — no pointer required.
 */
export function findEmailImageBesidePartnerAfterStack(params: {
  dropped: EmailImageBesideHitRect
  others: EmailImageBesideHitRect[]
  pointer?: { x: number; y: number } | null
  maxVerticalGapPx?: number
}): { id: string; side: EmailImageBesideSide } | null {
  const gap = params.maxVerticalGapPx ?? 160
  if (params.pointer) {
    const direct = findEmailImageBesideHit(params.pointer.x, params.pointer.y, params.others)
    if (direct) return direct
  }

  let best: { id: string; side: EmailImageBesideSide; dist: number } | null = null
  const d = params.dropped
  if (d.width <= 0 || d.height <= 0) return null

  const dBottom = d.top + d.height
  const dCenterX = d.left + d.width / 2
  const dCenterY = d.top + d.height / 2

  for (const other of params.others) {
    if (other.width <= 0 || other.height <= 0) continue
    const oBottom = other.top + other.height
    const oCenterX = other.left + other.width / 2
    const oCenterY = other.top + other.height / 2

    const overlapX =
      Math.min(d.left + d.width, other.left + other.width) - Math.max(d.left, other.left)
    const horizontalClose =
      overlapX > 20 || Math.abs(dCenterX - oCenterX) <= Math.max(d.width, other.width) * 0.6

    const gapAbove = other.top - dBottom
    const gapBelow = d.top - oBottom
    const stackedNear =
      (gapAbove >= -4 && gapAbove <= gap) ||
      (gapBelow >= -4 && gapBelow <= gap) ||
      Math.abs(dCenterY - oCenterY) <= Math.max(d.height, other.height) + gap

    if (!horizontalClose || !stackedNear) continue

    const pointerX = params.pointer?.x ?? dCenterX
    const side = resolveEmailImageBesideSide(pointerX, other) || 'right'
    const dist = Math.min(
      Math.abs(gapAbove),
      Math.abs(gapBelow),
      Math.abs(dCenterY - oCenterY)
    )
    if (!best || dist < best.dist) best = { id: other.id, side, dist }
  }
  return best ? { id: best.id, side: best.side } : null
}
