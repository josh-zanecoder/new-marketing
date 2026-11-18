/** Copy for Custom Flyers upload loader overlay. */
export const FLYER_UPLOAD_LOADER_TITLE = 'Polishing your flyer…' as const

/** Friendly rotating status lines while the file uploads. */
export const FLYER_UPLOAD_LOADER_HINTS = [
  'Warming up the print press…',
  'Tucking it into your Custom Flyers library…',
  'Making sure it looks sharp on paper…',
  'Almost hung on the gallery wall…'
] as const

export const FLYER_UPLOAD_LOADER_HINT_ROTATE_MS = 2200 as const

export const FLYER_DELETE_CONFIRM_TITLE = 'Delete flyer' as const
export const FLYER_DELETE_CONFIRM_TEXT = 'Delete' as const

export function buildFlyerDeleteConfirmMessage(flyerName: string): string {
  const name = String(flyerName ?? '').trim() || 'this flyer'
  return `Delete flyer “${name}”? This also removes the hosted file.`
}
