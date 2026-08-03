import type { FilterQuery, PipelineStage } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import type { BrevoEmailEventType } from '@server/utils/tracking/brevoEventType'
import type { BrevoTrackingEmailEvent } from '@server/utils/tracking/brevoTenantEvents'
import { parseYmdToExactUtcBounds } from '@server/utils/tracking/brevoTrackingEventDateBounds'

export interface LoadStoredTenantBrevoTrackingEventsPageOptions {
  campaignId?: string | null
  fromYmd?: string | null
  toYmd?: string | null
  tzOffsetMinutes?: number | null
  /** Forced ownership scope (`null` = tenant-wide). Empty array → no rows. */
  userEmails?: string[] | null
  /**
   * Optional UI User filter. Narrows rows only — `tagUsers` stays the full
   * date/campaign/ownership window.
   */
  filterUserEmails?: string[] | null
  brevoEventTypes?: BrevoEmailEventType[] | null
  /** Free-text search (email, subject, messageId, tag, campaignId). */
  search?: string | null
  page?: number
  pageSize?: number
}

export type StoredTrackingMessageGroup = {
  messageId: string
  events: BrevoTrackingEmailEvent[]
}

export type LoadStoredTenantBrevoTrackingEventsPageResult = {
  /** Current page of message groups (events sorted oldest→newest). */
  messageGroups: StoredTrackingMessageGroup[]
  /** Flat events for the current page (compat / empty checks). */
  events: BrevoTrackingEmailEvent[]
  /** Daily buckets for the activity chart (`date` is YMD). */
  chartEvents: Array<{ date: string; event: string; count: number }>
  /** Raw event → count in the filter scope (before event-type table filter). */
  eventCounts: Record<string, number>
  totalEvents: number
  totalMessages: number
  page: number
  pageSize: number
  totalPages: number
  tagUsers: string[]
}

type StoredTrackingEventLean = {
  email?: string
  date?: string
  messageId?: string
  event?: string
  tag?: string
  userEmail?: string
  subject?: string
  from?: string
  ip?: string
  link?: string
  reason?: string
  eventAt?: Date | null
}

function docToEvent(doc: StoredTrackingEventLean): BrevoTrackingEmailEvent {
  return {
    email: doc.email || undefined,
    date: doc.date || undefined,
    messageId: doc.messageId || undefined,
    event: doc.event || undefined,
    tag: doc.tag || undefined,
    subject: doc.subject || undefined,
    from: doc.from || undefined,
    ip: doc.ip || undefined,
    link: doc.link || undefined,
    reason: doc.reason || undefined
  }
}

function normalizeTagUsers(emails: string[]): string[] {
  return [
    ...new Set(
      emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))
    )
  ].sort((a, b) => a.localeCompare(b))
}

function buildEventTypeFilter(
  brevoEventTypes: BrevoEmailEventType[] | null
): string[] | null {
  if (!brevoEventTypes?.length) return null
  const types = new Set<string>(brevoEventTypes)
  if (types.has('requests')) types.add('sent')
  if (types.has('opened')) {
    types.add('unique_opened')
    types.add('open')
  }
  if (types.has('clicks')) types.add('click')
  return [...types]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function emptyResult(
  page: number,
  pageSize: number,
  tagUsers: string[] = []
): LoadStoredTenantBrevoTrackingEventsPageResult {
  return {
    messageGroups: [],
    events: [],
    chartEvents: [],
    eventCounts: {},
    totalEvents: 0,
    totalMessages: 0,
    page,
    pageSize,
    totalPages: 1,
    tagUsers
  }
}

/**
 * Paginated Tracking rows from tenant `brevo_tracking_events` (Mongo only).
 * Groups by messageId; pill counts come from a cheap `$group` on `event`.
 */
export async function loadStoredTenantBrevoTrackingEventsPage(
  dbName: string,
  options: LoadStoredTenantBrevoTrackingEventsPageOptions = {}
): Promise<LoadStoredTenantBrevoTrackingEventsPageResult> {
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20))
  const page = Math.max(1, options.page ?? 1)
  const offset = (page - 1) * pageSize

  const fromYmd = options.fromYmd ?? null
  const toYmd = options.toYmd ?? null
  const tzOffsetMinutes = options.tzOffsetMinutes ?? null
  const userEmails = options.userEmails === undefined ? null : options.userEmails
  const filterUserEmails =
    options.filterUserEmails === undefined ? null : options.filterUserEmails
  const campaignId = options.campaignId?.trim() || null
  const brevoEventTypes = options.brevoEventTypes?.length
    ? options.brevoEventTypes
    : null
  const search = options.search?.trim() || ''

  if (userEmails != null && userEmails.length === 0) {
    return emptyResult(page, pageSize)
  }

  const conn = await getTenantConnectionByDbName(dbName)
  const { BrevoTrackingEvent } = getTenantClientModels(conn)

  /** Date + campaign + session ownership — used for tagUsers + default scope. */
  const scopeFilter: FilterQuery<Record<string, unknown>> = {}
  if (campaignId) scopeFilter.campaignId = campaignId
  if (userEmails != null) {
    scopeFilter.userEmail = {
      $in: userEmails.map((e) => e.trim().toLowerCase())
    }
  }

  const bounds = parseYmdToExactUtcBounds(fromYmd, toYmd, tzOffsetMinutes)
  if (bounds) {
    scopeFilter.eventAt = { $gte: bounds.start, $lte: bounds.end }
  }

  const hasOptionalUserFilter = filterUserEmails != null
  if (hasOptionalUserFilter && !filterUserEmails.length) {
    const distinctUsers = (await BrevoTrackingEvent.distinct(
      'userEmail',
      scopeFilter
    )) as string[]
    return emptyResult(page, pageSize, normalizeTagUsers(distinctUsers))
  }

  const baseFilter: FilterQuery<Record<string, unknown>> = { ...scopeFilter }
  if (hasOptionalUserFilter && filterUserEmails.length) {
    baseFilter.userEmail = {
      $in: filterUserEmails.map((e) => e.trim().toLowerCase())
    }
  }

  if (search) {
    const re = new RegExp(escapeRegex(search), 'i')
    baseFilter.$or = [
      { email: re },
      { subject: re },
      { messageId: re },
      { tag: re },
      { campaignId: re }
    ]
  }

  const eventTypeValues = buildEventTypeFilter(brevoEventTypes)
  const listFilter: FilterQuery<Record<string, unknown>> = { ...baseFilter }
  if (eventTypeValues) {
    listFilter.event = { $in: eventTypeValues }
  }

  const eventSelect = {
    email: 1,
    date: 1,
    messageId: 1,
    event: 1,
    tag: 1,
    subject: 1,
    from: 1,
    ip: 1,
    link: 1,
    reason: 1,
    eventAt: 1,
    _id: 0
  }

  const messageIdPipeline: PipelineStage[] = [
    { $match: listFilter },
    {
      $group: {
        _id: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ['$messageId', ''] } }, 0] },
            '$messageId',
            '(no message id)'
          ]
        },
        latestAt: {
          $max: {
            $ifNull: ['$eventAt', { $toDate: { $ifNull: ['$date', 0] } }]
          }
        }
      }
    },
    { $sort: { latestAt: -1 as const } },
    {
      $facet: {
        total: [{ $count: 'n' }],
        page: [{ $skip: offset }, { $limit: pageSize }]
      }
    }
  ]

  const countsPipeline: PipelineStage[] = [
    { $match: baseFilter },
    { $group: { _id: '$event', count: { $sum: 1 } } }
  ]

  const offsetMinutes =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : 0

  const chartPipeline: PipelineStage[] = [
    { $match: baseFilter },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $subtract: [
                  { $ifNull: ['$eventAt', { $toDate: '$date' }] },
                  offsetMinutes * 60_000
                ]
              }
            }
          },
          event: '$event'
        },
        count: { $sum: 1 }
      }
    }
  ]

  const [distinctUsers, countsRows, messageFacet, chartRows] = await Promise.all([
    BrevoTrackingEvent.distinct('userEmail', scopeFilter) as Promise<string[]>,
    BrevoTrackingEvent.aggregate(countsPipeline).exec() as Promise<
      Array<{ _id: string | null; count: number }>
    >,
    BrevoTrackingEvent.aggregate(messageIdPipeline).exec() as Promise<
      Array<{
        total?: Array<{ n: number }>
        page?: Array<{ _id: string; latestAt?: Date }>
      }>
    >,
    BrevoTrackingEvent.aggregate(chartPipeline).exec() as Promise<
      Array<{ _id: { day?: string; event?: string }; count: number }>
    >
  ])

  const eventCounts: Record<string, number> = {}
  let totalEvents = 0
  for (const row of countsRows) {
    const key = (row._id || '').trim()
    if (!key) continue
    eventCounts[key] = row.count
    totalEvents += row.count
  }

  const chartEvents = chartRows
    .map((row) => ({
      date: (row._id?.day || '').trim(),
      event: (row._id?.event || '').trim(),
      count: row.count
    }))
    .filter((row) => row.date && row.event)

  const facet = messageFacet[0] ?? {}
  const totalMessages = facet.total?.[0]?.n ?? 0
  const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize))
  const pageIds = (facet.page ?? []).map((r) => r._id)

  if (!pageIds.length) {
    return {
      messageGroups: [],
      events: [],
      chartEvents,
      eventCounts,
      totalEvents,
      totalMessages,
      page: Math.min(page, totalPages),
      pageSize,
      totalPages,
      tagUsers: normalizeTagUsers(distinctUsers)
    }
  }

  const realIds = pageIds.filter((id) => id !== '(no message id)')
  const includeMissingId = pageIds.includes('(no message id)')

  const messageIdClause: FilterQuery<Record<string, unknown>> = includeMissingId
    ? {
        $or: [
          ...(realIds.length ? [{ messageId: { $in: realIds } }] : []),
          { messageId: '' },
          { messageId: null }
        ]
      }
    : { messageId: { $in: realIds } }

  const eventsFilter: FilterQuery<Record<string, unknown>> = {
    $and: [baseFilter, messageIdClause]
  }

  const docs = (await BrevoTrackingEvent.find(eventsFilter)
    .select(eventSelect)
    .lean()
    .exec()) as unknown as StoredTrackingEventLean[]

  const byMessage = new Map<string, BrevoTrackingEmailEvent[]>()
  for (const doc of docs) {
    const key = doc.messageId?.trim() || '(no message id)'
    const list = byMessage.get(key)
    const ev = docToEvent(doc)
    if (list) list.push(ev)
    else byMessage.set(key, [ev])
  }

  const messageGroups: StoredTrackingMessageGroup[] = pageIds.map((messageId) => {
    const evs = byMessage.get(messageId) ?? []
    evs.sort(
      (a, b) =>
        new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    )
    return { messageId, events: evs }
  })

  const events = messageGroups.flatMap((g) => g.events)

  return {
    messageGroups,
    events,
    chartEvents,
    eventCounts,
    totalEvents,
    totalMessages,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    tagUsers: normalizeTagUsers(distinctUsers)
  }
}
