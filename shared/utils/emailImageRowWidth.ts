import {
  EMAIL_IMAGE_WIDTH_DEFAULT_PCT,
  EMAIL_IMAGE_WIDTH_MAX_PCT,
  EMAIL_IMAGE_WIDTH_MIN_PCT
} from '../constants/emailImageRow'

/** Clamp a per-image width percent used inside one image-row cell. */
export function clampEmailImageWidthPct(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return EMAIL_IMAGE_WIDTH_DEFAULT_PCT
  return Math.max(EMAIL_IMAGE_WIDTH_MIN_PCT, Math.min(EMAIL_IMAGE_WIDTH_MAX_PCT, Math.round(n)))
}

/**
 * Styles for one image only — siblings keep their own width.
 * Always block + height:auto so side-by-side images never overlap.
 */
export function emailImageIndependentWidthStyle(widthPct: unknown): Record<string, string> {
  const clamped = clampEmailImageWidthPct(widthPct)
  return {
    display: 'block',
    width: `${clamped}%`,
    'max-width': '100%',
    height: 'auto',
    border: '0',
    float: 'none',
    position: 'static'
  }
}

/**
 * Convert a px resize result into a % of the parent cell width.
 * Falls back to 100 when the cell width is unknown.
 */
export function pxWidthToCellPercent(pxWidth: number, cellWidthPx: number): number {
  if (!Number.isFinite(pxWidth) || pxWidth <= 0) return EMAIL_IMAGE_WIDTH_DEFAULT_PCT
  if (!Number.isFinite(cellWidthPx) || cellWidthPx <= 0) return EMAIL_IMAGE_WIDTH_DEFAULT_PCT
  return clampEmailImageWidthPct((pxWidth / cellWidthPx) * 100)
}
