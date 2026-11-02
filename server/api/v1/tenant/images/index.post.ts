import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { uploadCustomMarketingImageDataUrlToGcs } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantLoRecipientLists } from '@server/utils/requireTenantLoRecipientLists'
import { CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES } from '~~/shared/customMarketingEmailSize'
import {
  CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
  parseCustomMarketingImageDataUrl
} from '~~/shared/customMarketingHostedImages'

/**
 * Upload an image into the tenant media library (`…/library/…`).
 * Returns a public HTTPS URL suitable for email `<img src>`.
 * Gated by superadmin `allowTenantLoRecipientLists`.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantLoRecipientLists(
    event,
    'Image library is disabled for this tenant'
  )

  const body = (await readBody(event).catch(() => null)) as { dataUrl?: string } | null
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl.trim() : ''
  if (!dataUrl) {
    throw createError({ statusCode: 400, message: 'dataUrl is required' })
  }

  const parsed = parseCustomMarketingImageDataUrl(dataUrl)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Invalid image data URL.' })
  }

  const approxBytes = Math.floor((parsed.base64.length * 3) / 4)
  if (approxBytes > CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES * 2) {
    throw createError({
      statusCode: 400,
      message: 'Image is too large. Compress or use a smaller photo.'
    })
  }

  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const uploaded = await uploadCustomMarketingImageDataUrlToGcs({
    tenantName,
    recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
    dataUrl
  })

  return {
    ok: true,
    url: uploaded.url,
    objectPath: uploaded.objectPath,
    id: uploaded.objectPath
  }
})
