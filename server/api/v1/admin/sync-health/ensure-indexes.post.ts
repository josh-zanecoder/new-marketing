import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { ensureMarketingSyncHealthIndexes } from '@server/utils/marketingSyncHealth/store'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)
  const indexes = await ensureMarketingSyncHealthIndexes()
  return { ok: true, indexes }
})
