import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { uploadCustomMarketingImageDataUrlToGcs } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES } from '~~/shared/customMarketingEmailSize'
import {
  CUSTOM_MARKETING_GCS_NO_LIST_FOLDER,
  parseCustomMarketingImageDataUrl
} from '~~/shared/customMarketingHostedImages'

export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)

  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  const body = (await readBody(event).catch(() => null)) as {
    dataUrl?: string
    recipientListId?: string
  } | null

  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl.trim() : ''
  const recipientListId =
    typeof body?.recipientListId === 'string' && body.recipientListId.trim()
      ? body.recipientListId.trim()
      : CUSTOM_MARKETING_GCS_NO_LIST_FOLDER

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
    recipientListId,
    dataUrl
  })

  return { ok: true, url: uploaded.url, objectPath: uploaded.objectPath }
})
