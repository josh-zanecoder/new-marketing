import { TENANT_EMAIL_PROVIDER_ZC_MAIL } from '@server/constants/emailProvider'
import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery
} from '@server/utils/tracking/brevoTenantEvents'
import { resolveTrackingTenantContext } from '@server/utils/tracking/resolveTrackingTenantContext'
import { syncTenantBrevoTrackingEvents } from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import { syncTenantZcMailTrackingEvents } from '@server/utils/tracking/syncTenantZcMailTrackingEvents'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'
import {
  requireZcMailSendConfig,
  resolveTenantEmailSendConfig
} from '@server/utils/zcmail/resolveTenantEmailSendConfig'

/**
 * Pull provider events for the active date range into the tenant DB.
 * Tracking GET reads Mongo only; the UI calls this on Refresh.
 * Brevo → events API. zcMail → archive list/detail.
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

  const emailConfig = await resolveTenantEmailSendConfig(dbName)
  if (emailConfig.provider === TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    let config
    try {
      config = requireZcMailSendConfig(emailConfig)
    } catch (e: unknown) {
      throwBrevoTrackingFetchError(e instanceof Error ? e.message : String(e))
    }
    const result = await syncTenantZcMailTrackingEvents({
      dbName,
      config,
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
      modified: result.modified,
      deduped: result.deduped ?? 0,
      timingsMs: result.timingsMs,
      provider: TENANT_EMAIL_PROVIDER_ZC_MAIL,
      ...(result.debug ? { debug: result.debug } : {})
    }
  }

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
    modified: result.modified,
    deduped: result.deduped ?? 0,
    timingsMs: result.timingsMs
  }
})
