import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { loadTenantBrevoTrackingEvents } from '@server/utils/tracking/loadTenantBrevoTrackingEvents'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'

export default defineEventHandler(async (event) => {
  const { dbName, marketingTenantId, userEmails } = await resolveTrackingTenantContext(event)

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')

  const { events, error } = await loadTenantBrevoTrackingEvents(dbName, marketingTenantId, {
    campaignId,
    fromYmd,
    toYmd,
    userEmails
  })

  if (error) {
    throwBrevoTrackingFetchError(error)
  }

  return { report: { events } }
})
