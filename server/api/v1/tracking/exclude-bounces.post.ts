import { normalizeCampaignIdQuery } from '@server/utils/tracking/brevoTenantEvents'
import { excludeHardBouncesFromRecipientList } from '@server/utils/tracking/excludeHardBouncesFromRecipientList'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'

/**
 * Soft-remove hard-bounce recipients from the campaign's recipient list.
 */
export default defineEventHandler(async (event) => {
  const { dbName } = await resolveTrackingTenantContext(event)
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const campaignId =
    normalizeCampaignIdQuery(event) ||
    (typeof body.campaignId === 'string' ? body.campaignId.trim() : '')

  if (!campaignId) {
    throw createError({ statusCode: 400, message: 'campaignId is required' })
  }

  const result = await excludeHardBouncesFromRecipientList({
    dbName,
    auth: event.context.auth,
    campaignId
  })

  return { ok: true as const, ...result }
})
