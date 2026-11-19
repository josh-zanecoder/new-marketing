/** Horizontal placement for images in the visual Template Builder (email-safe). */
export const EMAIL_IMAGE_ALIGNS = ['left', 'center', 'right'] as const

export type EmailImageAlign = (typeof EMAIL_IMAGE_ALIGNS)[number]

export const EMAIL_IMAGE_ALIGN_ATTR = 'data-email-image-align'

export const EMAIL_IMAGE_ALIGN_OPTIONS: { value: EmailImageAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' }
]
