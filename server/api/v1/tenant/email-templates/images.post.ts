import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { requireTenantInsertImage } from '@server/utils/requireTenantInsertImage'
import { uploadCustomMarketingImageDataUrlToGcs } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES } from '~~/shared/customMarketingEmailSize'
import { parseCustomMarketingImageDataUrl } from '~~/shared/customMarketingHostedImages'

/** GCS subfolder under custom-marketing/{tenant}/ for HTML email template images. */
export const EMAIL_TEMPLATE_GCS_IMAGE_FOLDER = 'email-templates'

/**
 * Host an image for HTML email templates (public HTTPS URL for img src).
 * Reuses Custom Marketing GCS upload; stores under `…/email-templates/…`.
 * Requires the tenant Insert image permission. Works on new and existing templates.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantInsertImage(event)

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
    recipientListId: EMAIL_TEMPLATE_GCS_IMAGE_FOLDER,
    dataUrl
  })

  return { ok: true, url: uploaded.url, objectPath: uploaded.objectPath }
})
