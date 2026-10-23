import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { buildContactEngagementTimeline } from '@server/utils/tracking/contactEngagementTimeline'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact, BrevoTrackingEvent, Campaign } = getTenantClientModels(conn)
  const auth = event.context.auth as unknown
  const contact = await Contact.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: rawId }, auth)
  )
    .select('email')
    .lean<{ email?: string } | null>()
    .exec()

  if (!contact) throw createError({ statusCode: 404, message: 'Contact not found' })

  const email = String(contact.email || '').trim().toLowerCase()
  if (!email) {
    return {
      events: [],
      summary: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    }
  }

  const tracking = await resolveTrackingTenantContext(event)
  const match: Record<string, unknown> = {
    email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  }
  if (tracking.userEmails != null) {
    match.userEmail = { $in: tracking.userEmails.map((value) => value.trim().toLowerCase()) }
  }

  const docs = await BrevoTrackingEvent.find(match)
    .select('event eventAt date messageId subject campaignId link reason')
    .sort({ eventAt: -1 })
    .limit(400)
    .lean<
      {
        _id: unknown
        event?: string
        eventAt?: Date | null
        date?: string
        messageId?: string
        subject?: string
        campaignId?: string
        link?: string
        reason?: string
      }[]
    >()
    .exec()

  const campaignIds = [
    ...new Set(
      docs
        .map((row) => String(row.campaignId || '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]
  const campaignNames = new Map<string, string>()
  if (campaignIds.length) {
    const campaigns = await Campaign.find({
      _id: { $in: campaignIds.map((id) => new mongoose.Types.ObjectId(id)) }
    })
      .select('name')
      .lean<{ _id: unknown; name?: string }[]>()
      .exec()
    for (const campaign of campaigns) {
      const name = String(campaign.name || '').trim()
      if (name) campaignNames.set(String(campaign._id), name)
    }
  }

  return buildContactEngagementTimeline(
    docs.map((row) => ({
      id: String(row._id),
      event: String(row.event || ''),
      eventAt: row.eventAt,
      date: row.date,
      messageId: row.messageId,
      subject: row.subject,
      campaignId: row.campaignId,
      link: row.link,
      reason: row.reason
    })),
    campaignNames
  )
})
