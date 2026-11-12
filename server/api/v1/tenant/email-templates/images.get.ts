import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { listCustomMarketingTenantImages } from '@server/services/customMarketingImageUpload.service'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { requireTenantEmailTemplateImageHost } from '@server/utils/requireTenantInsertImage'

/**
 * List images already uploaded for this tenant (library, email templates, and other hosted photos).
 * Same access as the upload route. Does not use the Images library flag.
 */
export default defineEventHandler(async (event) => {
  await getTenantConnectionFromEvent(event)
  const { auth } = await requireTenantEmailTemplateImageHost(event)
  const tenantName = await resolveCustomMarketingTenantFolderName(auth)
  const items = await listCustomMarketingTenantImages(tenantName)

  return {
    ok: true,
    items,
    total: items.length
  }
})
