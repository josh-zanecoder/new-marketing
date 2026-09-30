import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { fetchAdminEmailTemplatePreview } from '@server/utils/admin/listAdminEmailTemplates'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  const query = getQuery(event)
  const tenantDbName = String(query.tenantDbName ?? '')
  const id = String(query.id ?? '')
  return fetchAdminEmailTemplatePreview(tenantDbName, id)
})
