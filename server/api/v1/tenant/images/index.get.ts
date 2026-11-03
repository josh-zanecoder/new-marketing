import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { listCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantLoRecipientLists } from '@server/utils/requireTenantLoRecipientLists'

/**
 * List hosted tenant images (public HTTPS URLs) for the Images gallery.
 * Gated by superadmin `allowTenantLoRecipientLists`.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantLoRecipientLists(
    event,
    'Image library is disabled for this tenant'
  )

  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const items = await listCustomMarketingTenantImages(tenantName)

  return {
    ok: true,
    items,
    total: items.length
  }
})
