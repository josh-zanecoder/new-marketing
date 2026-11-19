import { EMAIL_IMAGE_BESIDE_ZONE_RATIO } from '../constants/emailImageRow'

export type EmailImageBesideSide = 'left' | 'right'

/**
 * Map pointer X to a beside intent on an image rect.
 * With the default 0.5 ratio, the whole image is left|right (midpoint split).
 */
export function resolveEmailImageBesideSide(
  clientX: number,
  rect: { left: number; width: number },
  zoneRatio: number = EMAIL_IMAGE_BESIDE_ZONE_RATIO
): EmailImageBesideSide | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left) || !Number.isFinite(rect.width)) {
    return null
  }
  if (rect.width <= 0) return null
  const ratio = Math.max(0.1, Math.min(0.5, zoneRatio))
  if (ratio >= 0.5) {
    const mid = rect.left + rect.width / 2
    return clientX < mid ? 'left' : 'right'
  }
  const zone = rect.width * ratio
  if (clientX < rect.left + zone) return 'left'
  if (clientX > rect.left + rect.width - zone) return 'right'
  return null
}
