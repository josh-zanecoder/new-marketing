import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { deleteCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantImages } from '@server/utils/requireTenantImages'
import { hostedImageViewerFromAuth } from '@server/utils/hostedImage/hostedImageAccessFromAuth'

/**
 * Delete one or more hosted tenant images from GCS.
 * Gated by superadmin `allowTenantImages`.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantImages(
    event,
    'Image library is disabled for this tenant'
  )

  const body = (await readBody(event).catch(() => null)) as {
    objectPaths?: unknown
    objectPath?: unknown
  } | null

  const rawList = Array.isArray(body?.objectPaths)
    ? body!.objectPaths
    : typeof body?.objectPath === 'string'
      ? [body.objectPath]
      : []

  const objectPaths = rawList
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)

  if (!objectPaths.length) {
    throw createError({
      statusCode: 400,
      message: 'Select at least one image to delete'
    })
  }

  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const viewer = hostedImageViewerFromAuth(auth)
  const result = await deleteCustomMarketingTenantImages(tenantName, objectPaths, viewer)

  if (!result.deleted.length) {
    throw createError({
      statusCode: 404,
      message: viewer.ownerEmails === null
        ? 'No matching images were deleted'
        : 'No matching images were deleted. You can only delete images you uploaded.'
    })
  }

  return {
    ok: true,
    deletedCount: result.deleted.length,
    deleted: result.deleted,
    skipped: result.skipped
  }
})
