import { assertAdminAuth, haltAllActiveCampaignSendsGlobal } from '@server/utils/admin/adminCampaigns'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  return haltAllActiveCampaignSendsGlobal()
})
