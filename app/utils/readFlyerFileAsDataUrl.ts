import { compressCustomMarketingImageFile } from '~/utils/compressCustomMarketingImage'
import { FLYER_MAX_FILE_BYTES } from '~~/shared/constants/flyerUpload'
import {
  assertFlyerFileWithinLimit,
  isAllowedFlyerMime,
  isFlyerImageMime,
  normalizeFlyerMime
} from '~~/shared/utils/flyerUpload'

function readBlobAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:')) {
        reject(new Error('Could not read file.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Prepare a flyer file for upload.
 * Images are compressed like the media library; PDFs are sent as-is.
 */
export async function readFlyerFileAsDataUrl(file: File): Promise<string> {
  const mime = normalizeFlyerMime(file.type)
  if (!isAllowedFlyerMime(mime)) {
    throw new Error('Use a PDF or image (PNG, JPEG, GIF, WebP).')
  }
  assertFlyerFileWithinLimit(file.size)

  if (isFlyerImageMime(mime)) {
    return compressCustomMarketingImageFile(file, {
      maxSourceBytes: FLYER_MAX_FILE_BYTES
    })
  }

  return readBlobAsDataUrl(file)
}
