import type { FilterQuery } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { BrevoEmailEventType } from '@server/utils/tracking/brevoEventType'
import { parseYmdToExactUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'
import { mongoEventValuesForFilter } from '@server/utils/tracking/mongoEventValuesForFilter'

function eventValuesForFilter(brevoEventTypes: BrevoEmailEventType[] | null): string[] | null {
  if (!brevoEventTypes?.length) return null
  const types = new Set<string>()
  for (const t of brevoEventTypes) {
    const expanded = mongoEventValuesForFilter(t)
    if (expanded?.length) {
      for (const v of expanded) types.add(v)
    } else {
      types.add(t)
    }
  }
  return types.size ? [...types] : null
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Distinct recipient emails for the current Tracking filters (all pages, not the visible table page). */
export async function distinctTrackingRecipientEmails(
  dbName: string,
  options: {
    campaignId?: string | null
    fromYmd?: string | null
    toYmd?: string | null
    tzOffsetMinutes?: number | null
    userEmails?: string[] | null
    filterUserEmails?: string[] | null
    brevoEventTypes?: BrevoEmailEventType[] | null
    search?: string | null
  }
): Promise<string[]> {
  const userEmails = options.userEmails === undefined ? null : options.userEmails
  if (userEmails != null && userEmails.length === 0) return []

  const filterUserEmails =
    options.filterUserEmails === undefined ? null : options.filterUserEmails
  if (filterUserEmails != null && filterUserEmails.length === 0) return []

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  const filter: FilterQuery<Record<string, unknown>> = {
    email: { $regex: /@/ }
  }
  const campaignId = options.campaignId?.trim()
  if (campaignId) filter.campaignId = campaignId
  if (userEmails != null) {
    filter.userEmail = { $in: userEmails.map((e) => e.trim().toLowerCase()) }
  }
  if (filterUserEmails?.length) {
    filter.userEmail = { $in: filterUserEmails.map((e) => e.trim().toLowerCase()) }
  }

  const bounds = parseYmdToExactUtcBounds(
    options.fromYmd,
    options.toYmd,
    options.tzOffsetMinutes
  )
  if (bounds) filter.eventAt = { $gte: bounds.start, $lte: bounds.end }

  const search = options.search?.trim() || ''
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { email: re },
      { subject: re },
      { messageId: re },
      { tag: re },
      { campaignId: re }
    ]
  }

  const eventValues = eventValuesForFilter(options.brevoEventTypes ?? null)
  if (eventValues) filter.event = { $in: eventValues }

  const emails = (await BrevoTrackingEvent.distinct('email', filter)) as string[]
  return [
    ...new Set(
      emails.map((email) => String(email || '').trim().toLowerCase()).filter((email) => email.includes('@'))
    )
  ]
}
