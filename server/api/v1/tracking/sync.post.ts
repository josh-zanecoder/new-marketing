import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { syncTenantBrevoTrackingEvents } from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'

/**
 * Pull Brevo events for the active date range into the tenant DB.
 * Tracking GET reads Mongo only; the UI calls this on Refresh.
 */
export default defineEventHandler(async (event) => {
  const { dbName, marketingTenantId } = await resolveTrackingTenantContext(event)

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const q = getQuery(event) as Record<string, unknown>

  const fromRaw = body?.from ?? q.from
  const toRaw = body?.to ?? q.to
  const campaignRaw = body?.campaignId ?? q.campaignId

  const fromYmd =
    typeof fromRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw.trim())
      ? fromRaw.trim()
      : normalizeYmdQuery(event, 'from')
  const toYmd =
    typeof toRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toRaw.trim())
      ? toRaw.trim()
      : normalizeYmdQuery(event, 'to')

  const campaignId =
    typeof campaignRaw === 'string' && /^[a-f\d]{24}$/i.test(campaignRaw.trim())
      ? campaignRaw.trim()
      : normalizeCampaignIdQuery(event)

  const result = await syncTenantBrevoTrackingEvents({
    dbName,
    marketingTenantId,
    fromYmd,
    toYmd,
    campaignId
  })

  if (result.error) {
    throwBrevoTrackingFetchError(result.error)
  }

  return {
    ok: true as const,
    fetched: result.fetched,
    upserted: result.upserted,
    modified: result.modified
  }
})
