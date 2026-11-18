/** Printable flyer uploads: images + PDF. */
export const FLYER_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf'
] as const

export type FlyerAllowedMimeType = (typeof FLYER_ALLOWED_MIME_TYPES)[number]

/** `<input accept>` for the Add Flyer modal. */
export const FLYER_FILE_INPUT_ACCEPT = FLYER_ALLOWED_MIME_TYPES.join(',')

/** Soft cap for a single flyer file (PDF or image) before/after encoding. */
export const FLYER_MAX_FILE_BYTES = 15 * 1024 * 1024

export const FLYER_UPLOAD_HELP_TEXT =
  'PDF or image (PNG, JPEG, GIF, WebP). Files open for print from the gallery.' as const

/** Soft hint when a file is staged but the flyer name is still empty. */
export const FLYER_UPLOAD_NAME_REQUIRED_HINT =
  'Add a flyer name above to finish uploading.' as const
