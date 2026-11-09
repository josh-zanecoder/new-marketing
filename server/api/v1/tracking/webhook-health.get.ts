import { normalizeCampaignIdQuery } from '@server/utils/tracking/brevoTenantEvents'
import { loadTrackingWebhookHealth } from '@server/utils/tracking/loadTrackingWebhookHealth'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'

export default defineEventHandler(async (event) => {
  const { dbName } = await resolveTrackingTenantContext(event)
  const campaignId = normalizeCampaignIdQuery(event)
  const health = await loadTrackingWebhookHealth(dbName, {
    campaignId: campaignId || null
  })
  return { ok: true as const, health }
})
