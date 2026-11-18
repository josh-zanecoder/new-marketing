/** Marker on the outer table that holds side-by-side email images. */
export const EMAIL_IMAGE_ROW_ATTR = 'data-email-image-row'

/** Marker on each column cell inside an image row. */
export const EMAIL_IMAGE_ROW_CELL_ATTR = 'data-email-image-cell'

export const EMAIL_IMAGE_ROW_COUNTS = [2, 3, 4] as const
export type EmailImageRowCount = (typeof EMAIL_IMAGE_ROW_COUNTS)[number]

export const EMAIL_IMAGE_ROW_ALIGN = ['left', 'center', 'right'] as const
export type EmailImageRowAlign = (typeof EMAIL_IMAGE_ROW_ALIGN)[number]

export const EMAIL_IMAGE_ROW_VALIGN = ['top', 'middle', 'bottom'] as const
export type EmailImageRowVAlign = (typeof EMAIL_IMAGE_ROW_VALIGN)[number]

/** Default padding inside each image cell (spacing between images). */
export const EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX = 8

export const EMAIL_IMAGE_ROW_SPACING_MIN_PX = 0
export const EMAIL_IMAGE_ROW_SPACING_MAX_PX = 48

export const EMAIL_IMAGE_ROW_BLOCK_CATEGORY = 'Basic'

export const EMAIL_IMAGE_ROW_BLOCK_IDS = {
  two: 'email-images-2',
  three: 'email-images-3',
  four: 'email-images-4'
} as const

export const EMAIL_IMAGE_ROW_BLOCK_LABELS = {
  two: '2 Images',
  three: '3 Images',
  four: '4 Images'
} as const
