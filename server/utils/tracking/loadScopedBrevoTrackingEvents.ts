import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  resolveTenantIdForTenantAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import {
  normalizeCampaignIdQuery,
  normalizeYmdQuery,
  type BrevoTrackingEmailEvent
} from './brevoTenantEvents'
import { loadTenantBrevoTrackingEvents } from './loadTenantBrevoTrackingEvents'
import { resolveTrackingUserEmails } from './resolveTrackingTenantContext'

export async function loadScopedBrevoTrackingEvents(
  event: H3Event,
  tenantAuth: RegisteredTenantAuthContext
): Promise<{
  events: BrevoTrackingEmailEvent[]
  fromYmd: string | null
  toYmd: string | null
  campaignId: string | null
  error?: string
}> {
  const dbName = tenantAuth.dbName.trim()
  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  const campaignId = normalizeCampaignIdQuery(event)

  const registryConn = await getRegistryConnection()
  const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, tenantAuth)

  const { events, error } = await loadTenantBrevoTrackingEvents(dbName, marketingTenantId, {
    campaignId,
    fromYmd,
    toYmd,
    userEmails: resolveTrackingUserEmails(tenantAuth)
  })

  return { events, fromYmd, toYmd, campaignId, error }
}

