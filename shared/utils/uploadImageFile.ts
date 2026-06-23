const MAX_IMAGE_BYTES = 1_500_000

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
])

/** Read a local image file as a data URL for use in the email editor. */
export async function readImageFileAsDataUrl(file: File): Promise<string> {
  const type = (file.type || '').toLowerCase()
  if (!type.startsWith('image/') || !ALLOWED_IMAGE_TYPES.has(type)) {
    throw new Error('Please choose a JPEG, PNG, GIF, WebP, or SVG image')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max 1.5MB). Use a smaller file or paste a hosted image URL.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string' && result.startsWith('data:image/')) {
        resolve(result)
        return
      }
      reject(new Error('Could not read image file'))
    }
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })

  return dataUrl
}
