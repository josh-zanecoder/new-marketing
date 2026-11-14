import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { listCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantImages } from '@server/utils/requireTenantImages'
import { hostedImageViewerFromAuth } from '@server/utils/hostedImage/hostedImageAccessFromAuth'

/**
 * List hosted tenant images (public HTTPS URLs) for the Images gallery.
 * Gated by superadmin `allowTenantImages`.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantImages(
    event,
    'Image library is disabled for this tenant'
  )

  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const items = await listCustomMarketingTenantImages(tenantName, {
    viewer: hostedImageViewerFromAuth(auth)
  })

  return {
    ok: true,
    items,
    total: items.length
  }
})
