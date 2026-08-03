import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import { loadStoredTenantBrevoTrackingEventsPage } from '@server/utils/tracking/loadStoredTenantBrevoTrackingEventsPage'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'

function normalizePositiveInt(raw: unknown, fallback: number, max: number): number {
  const n =
    typeof raw === 'string'
      ? Number.parseInt(raw, 10)
      : typeof raw === 'number'
        ? raw
        : NaN
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(max, Math.floor(n))
}

function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, 200)
}

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
  const search = normalizeSearchQuery(q.q ?? q.search)
  const page = normalizePositiveInt(q.page, 1, 10_000)
  const pageSize = normalizePositiveInt(q.limit ?? q.pageSize, 20, 100)
  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    userEmails,
    requestedUserEmail,
    allowUserTagFilter
  )

  const result = await loadStoredTenantBrevoTrackingEventsPage(dbName, {
    campaignId,
    fromYmd,
    toYmd,
    tzOffsetMinutes,
    userEmails: ownershipEmails,
    filterUserEmails: filterEmails,
    brevoEventTypes: brevoEventTypes.length ? brevoEventTypes : null,
    search: search || null,
    page,
    pageSize
  })

  return {
    report: {
      ...result,
      allowUserTagFilter
    }
  }
})
