import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { resolveDefaultCampaignSenderForDbName } from '@server/utils/campaign/resolveDefaultCampaignSender'
import { listCampaignSenderCandidates } from '@server/utils/campaign/listCampaignSenderCandidates'

/**
 * Distinct CRM account owners (from contact metadata) for sender email autocomplete.
 * Only available when superadmin enabled `allowTenantEditSender` for this tenant.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }

  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  const registryConn = await getRegistryConnection()
  const defaults = await resolveDefaultCampaignSenderForDbName(registryConn, dbName)
  if (!defaults.allowTenantEditSender) {
    throw createError({
      statusCode: 403,
      message: 'Tenant sender editing is disabled for this tenant'
    })
  }

  const q = String(getQuery(event).q ?? '').trim()
  const limitRaw = Number(getQuery(event).limit)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 30) : 12

  const conn = await getTenantConnectionFromEvent(event)
  const { Contact } = getTenantClientModels(conn)
  const candidates = await listCampaignSenderCandidates(Contact, auth, { q, limit })

  return { candidates }
})
