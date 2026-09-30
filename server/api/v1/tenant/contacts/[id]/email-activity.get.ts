import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'

const OPEN_EVENTS = new Set(['opened', 'unique_opened', 'open', 'firstopening', 'loadedbyproxy'])
const CLICK_EVENTS = new Set(['clicks', 'click'])

type ActivityRow = {
  messageId: string
  subject: string
  sentAt: string | null
  opened: boolean
  clicked: boolean
}

function eventFlag(events: string[], set: Set<string>): boolean {
  return events.some((event) => set.has(event.trim().toLowerCase()))
}

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact, BrevoTrackingEvent } = getTenantClientModels(conn)
  const auth = event.context.auth as unknown
  const contact = await Contact.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: rawId }, auth)
  )
    .select('email')
    .lean<{ email?: string } | null>()
    .exec()

  if (!contact) throw createError({ statusCode: 404, message: 'Contact not found' })

  const email = String(contact.email || '').trim().toLowerCase()
  if (!email) return { messages: [] as ActivityRow[] }

  const tracking = await resolveTrackingTenantContext(event)
  const match: Record<string, unknown> = {
    email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  }
  if (tracking.userEmails != null) {
    match.userEmail = { $in: tracking.userEmails.map((value) => value.trim().toLowerCase()) }
  }

  const grouped = await BrevoTrackingEvent.aggregate<{
    _id: string
    subject: string
    latest: Date | null
    events: string[]
  }>([
    { $match: match },
    { $sort: { eventAt: -1 } },
    {
      $group: {
        _id: '$messageId',
        subject: { $first: '$subject' },
        latest: { $max: '$eventAt' },
        events: { $addToSet: '$event' }
      }
    },
    { $sort: { latest: -1 } },
    { $limit: 50 }
  ])

  const messages: ActivityRow[] = grouped
    .filter((row) => String(row._id || '').trim())
    .map((row) => {
      const events = Array.isArray(row.events) ? row.events.map((value) => String(value || '')) : []
      return {
        messageId: String(row._id),
        subject: String(row.subject || '').trim() || 'No subject',
        sentAt: row.latest instanceof Date ? row.latest.toISOString() : null,
        opened: eventFlag(events, OPEN_EVENTS),
        clicked: eventFlag(events, CLICK_EVENTS)
      }
    })

  return { messages }
})
