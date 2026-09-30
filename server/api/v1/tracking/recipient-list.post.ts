import { getTenantConnectionByDbName } from '@server/tenant/connection'
import { createStaticRecipientListFromEmails } from '@server/utils/recipient/createStaticRecipientListFromEmails'
import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeUserEmailQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import { distinctTrackingRecipientEmails } from '@server/utils/tracking/distinctTrackingRecipientEmails'
import {
  mergeTrackingUserEmails,
  resolveTrackingTenantContext
} from '@server/utils/tracking/resolveTrackingTenantContext'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) throw createError({ statusCode: 400, message: 'Name is required' })

  const ctx = await resolveTrackingTenantContext(event)
  const q = getQuery(event) as Record<string, unknown>
  const campaignId = normalizeCampaignIdQuery(event) || String(body.campaignId ?? '').trim()
  const fromYmd = normalizeYmdQuery(event, 'from') || (typeof body.from === 'string' ? body.from.trim() : '')
  const toYmd = normalizeYmdQuery(event, 'to') || (typeof body.to === 'string' ? body.to.trim() : '')
  const tzOffsetMinutes =
    normalizeTzOffsetQuery(event) ??
    (typeof body.tzOffset === 'number' ? body.tzOffset : Number(body.tzOffset))
  const requestedUserEmail =
    normalizeUserEmailQuery(event) ||
    (typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '')
  const brevoEventTypes = normalizeBrevoEventTypesQuery(
    q.event ?? q.events ?? body.events
  )
  const search =
    (typeof q.q === 'string' ? q.q : typeof body.q === 'string' ? body.q : '').trim().slice(0, 200)

  const { ownershipEmails, filterEmails } = mergeTrackingUserEmails(
    ctx.userEmails,
    requestedUserEmail || null,
    ctx.allowUserTagFilter
  )

  const emails = await distinctTrackingRecipientEmails(ctx.dbName, {
    campaignId: campaignId || null,
    fromYmd: fromYmd || null,
    toYmd: toYmd || null,
    tzOffsetMinutes: Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : null,
    userEmails: ownershipEmails,
    filterUserEmails: filterEmails,
    brevoEventTypes: brevoEventTypes.length ? brevoEventTypes : null,
    search: search || null
  })

  const tenantConn = await getTenantConnectionByDbName(ctx.dbName)
  const list = await createStaticRecipientListFromEmails({
    tenantConn,
    auth: event.context.auth,
    name,
    emails
  })

  return { ok: true, list }
})
