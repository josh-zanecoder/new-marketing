import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import { loadStoredTenantBrevoTrackingEvents } from '@server/utils/tracking/loadStoredTenantBrevoTrackingEvents'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'

export default defineEventHandler(async (event) => {
  const { dbName, userEmails, allowUserTagFilter } =
    await resolveTrackingTenantContext(event)

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  const requestedUserEmail = normalizeUserEmailQuery(event)
  const q = getQuery(event) as Record<string, unknown>
  const brevoEventTypes = normalizeBrevoEventTypesQuery(q.event ?? q.events)
  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    userEmails,
    requestedUserEmail,
    allowUserTagFilter
  )

  const { events, tagUsers } = await loadStoredTenantBrevoTrackingEvents(dbName, {
    campaignId,
    fromYmd,
    toYmd,
    tzOffsetMinutes,
    userEmails: ownershipEmails,
    filterUserEmails: filterEmails,
    brevoEventTypes: brevoEventTypes.length ? brevoEventTypes : null
  })

  return {
    report: {
      events,
      tagUsers,
      allowUserTagFilter
    }
  }
})
