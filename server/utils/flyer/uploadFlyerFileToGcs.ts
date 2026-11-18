import { uploadCustomMarketingBinaryToGcs } from '@server/services/customMarketingImageUpload.service'
import type { HostedImageOwnership } from '~~/shared/hostedImageAccess'
import { CUSTOM_MARKETING_GCS_FLYERS_FOLDER } from '~~/shared/constants/flyerCategory'
import { FLYER_MAX_FILE_BYTES } from '~~/shared/constants/flyerUpload'
import {
  assertFlyerFileWithinLimit,
  extensionForFlyerMime,
  isAllowedFlyerMime,
  parseFlyerDataUrl
} from '~~/shared/utils/flyerUpload'

/** Upload a flyer PDF/image data URL to the tenant flyers GCS folder. */
export async function uploadFlyerDataUrlToGcs(input: {
  tenantName: string
  dataUrl: string
  ownership?: HostedImageOwnership
}): Promise<{ url: string; objectPath: string; contentType: string; size: number }> {
  const parsed = parseFlyerDataUrl(input.dataUrl)
  if (!parsed || !isAllowedFlyerMime(parsed.mime)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid flyer file. Use a PDF or image (PNG, JPEG, GIF, WebP).'
    })
  }

  const size = Math.floor((parsed.base64.length * 3) / 4)
  try {
    assertFlyerFileWithinLimit(size)
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'File is too large.'
    })
  }

  const uploaded = await uploadCustomMarketingBinaryToGcs({
    tenantName: input.tenantName,
    recipientListId: CUSTOM_MARKETING_GCS_FLYERS_FOLDER,
    buffer: Buffer.from(parsed.base64, 'base64'),
    contentType: parsed.mime,
    fileExtension: extensionForFlyerMime(parsed.mime),
    maxBytes: FLYER_MAX_FILE_BYTES,
    emptyMessage: 'Flyer file is empty.',
    tooLargeMessage: 'File is too large. Use a PDF or image under 15MB.',
    ownership: input.ownership,
    contentDisposition: `inline; filename="flyer.${extensionForFlyerMime(parsed.mime)}"`
  })

  return {
    url: uploaded.url,
    objectPath: uploaded.objectPath,
    contentType: parsed.mime,
    size
  }
}
