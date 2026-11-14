import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { deleteCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantEmailTemplateImageHost } from '@server/utils/requireTenantInsertImage'
import { hostedImageViewerFromAuth } from '@server/utils/hostedImage/hostedImageAccessFromAuth'
import { findEmailTemplatesUsingHostedImage } from '@server/utils/hostedImage/findEmailTemplatesUsingHostedImage'
import { hostedImageInUseMessage } from '~~/shared/hostedImageAccess'

/**
 * Delete one uploaded image from the Template Builder Uploads library.
 * Same access as listing/uploading; refuses images still used by a template or campaign.
 */
export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantEmailTemplateImageHost(event)

  const body = (await readBody(event).catch(() => null)) as { objectPath?: unknown } | null
  const objectPath = typeof body?.objectPath === 'string' ? body.objectPath.trim() : ''
  if (!objectPath) {
    throw createError({ statusCode: 400, message: 'objectPath is required' })
  }

  const inUse = hostedImageInUseMessage(
    await findEmailTemplatesUsingHostedImage(conn, objectPath, auth)
  )
  if (inUse) {
    throw createError({ statusCode: 409, message: inUse })
  }

  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const viewer = hostedImageViewerFromAuth(auth)
  const result = await deleteCustomMarketingTenantImages(tenantName, [objectPath], viewer)

  if (!result.deleted.length) {
    throw createError({
      statusCode: 404,
      message: viewer.ownerEmails === null
        ? 'Image not found or already deleted.'
        : 'Image not found, or you can only delete images you uploaded.'
    })
  }

  return { ok: true, deleted: result.deleted[0] }
})
