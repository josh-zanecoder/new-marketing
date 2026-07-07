import {
  assertAdminAuth,
  cancelAllActiveCampaignSendsGlobal
} from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  const body = await readBody<{ tenantDbName?: string }>(event).catch(() => ({}))
  const tenantDbName = String(body?.tenantDbName ?? '').trim() || undefined
  return cancelAllActiveCampaignSendsGlobal({ tenantDbName })
})
