import { computeMarketingAnalytics } from '@server/utils/tracking/computeMarketingAnalytics'
import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { loadTenantBrevoTrackingEvents } from '@server/utils/tracking/loadTenantBrevoTrackingEvents'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'

export default defineEventHandler(async (event) => {
  const { dbName, marketingTenantId, userEmails, allowUserTagFilter } =
    await resolveTrackingTenantContext(event)

  const campaignId = normalizeCampaignIdQuery(event)
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  const requestedUserEmail = normalizeUserEmailQuery(event)
  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    userEmails,
    requestedUserEmail,
    allowUserTagFilter
  )

  const { events, tagUsers, error } = await loadTenantBrevoTrackingEvents(
    dbName,
    marketingTenantId,
    {
      campaignId,
      fromYmd,
      toYmd,
      tzOffsetMinutes,
      userEmails: ownershipEmails,
      filterUserEmails: filterEmails
    }
  )

  if (error) {
    throwBrevoTrackingFetchError(error)
  }

  const analytics = computeMarketingAnalytics(events, fromYmd, toYmd)

  return {
    analytics: {
      ...analytics,
      events,
      tagUsers,
      allowUserTagFilter
    }
  }
})
