import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { TENANT_EMAIL_PROVIDER_ZC_MAIL } from '@server/constants/emailProvider'
import { normalizeBrevoEventTypesQuery } from '@server/utils/tracking/brevoEventType'
import {
  normalizeCampaignIdQuery,
  normalizeTzOffsetQuery,
  normalizeYmdQuery,
  type BrevoTrackingEmailEvent
} from '@server/utils/tracking/brevoTenantEvents'
import { loadStoredTenantBrevoTrackingEventsPage } from '@server/utils/tracking/loadStoredTenantBrevoTrackingEventsPage'
import { syncTenantBrevoTrackingEvents } from '@server/utils/tracking/syncTenantBrevoTrackingEvents'
import { syncTenantZcMailTrackingEvents } from '@server/utils/tracking/syncTenantZcMailTrackingEvents'
import { throwBrevoTrackingFetchError } from '@server/utils/tracking/throwBrevoTrackingFetchError'
import {
  requireZcMailSendConfig,
  resolveTenantEmailSendConfig
} from '@server/utils/zcmail/resolveTenantEmailSendConfig'

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

export type AdminTrackingTenant = {
  dbName: string
  marketingTenantId: string | null
}

export function assertAdminTrackingAuth(event: H3Event): void {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object' || !isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
}

export function normalizeAdminTenantDbQuery(event: H3Event): string | undefined {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.tenantDbName
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  return s || undefined
}

export async function listAdminTrackingTenants(
  tenantDbName?: string
): Promise<AdminTrackingTenant[]> {
  const registry = await getRegistryConnection()
  const rawDocs = (await registry.collection('clients').find({}).toArray()) as unknown[]

  const tenants: AdminTrackingTenant[] = []
  for (const doc of rawDocs) {
    const row = toTenantAdminRow(doc as RegistryTenantDoc)
    if (!row?.dbName) continue
    if (tenantDbName && row.dbName !== tenantDbName) continue
    const marketingTenantId =
      typeof row.tenantId === 'string' && row.tenantId.trim() ? row.tenantId.trim() : null
    tenants.push({ dbName: row.dbName, marketingTenantId })
  }
  return tenants
}

/**
 * Admin tracking reads the selected tenant's synced Mongo events.
 * Multi-tenant (no tenantDbName) returns an empty report — sync requires a single tenant.
 */
export async function fetchAdminTrackingReport(event: H3Event): Promise<{
  report: Record<string, unknown> & { events: BrevoTrackingEmailEvent[] }
}> {
  const tenantDbName = normalizeAdminTenantDbQuery(event)
  if (!tenantDbName) {
    return {
      report: {
        events: [],
        messageGroups: [],
        chartEvents: [],
        eventCounts: {},
        totalEvents: 0,
        totalMessages: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        tagUsers: [],
        allowUserTagFilter: false
      }
    }
  }

  const tenants = await listAdminTrackingTenants(tenantDbName)
  if (!tenants.length) {
    throw createError({ statusCode: 403, message: 'Unknown tenant for admin tracking' })
  }

  const fromYmd = normalizeYmdQuery(event, 'from')
  const toYmd = normalizeYmdQuery(event, 'to')
  const campaignId = normalizeCampaignIdQuery(event)
  const tzOffsetMinutes = normalizeTzOffsetQuery(event)
  const q = getQuery(event) as Record<string, unknown>
  const brevoEventTypes = normalizeBrevoEventTypesQuery(q.event ?? q.events)
  const search = normalizeSearchQuery(q.q ?? q.search)
  const page = normalizePositiveInt(q.page, 1, 10_000)
  const pageSize = normalizePositiveInt(q.limit ?? q.pageSize, 20, 100)

  const result = await loadStoredTenantBrevoTrackingEventsPage(tenantDbName, {
    campaignId,
    fromYmd,
    toYmd,
    tzOffsetMinutes,
    userEmails: null,
    filterUserEmails: null,
    brevoEventTypes: brevoEventTypes.length ? brevoEventTypes : null,
    search: search || null,
    page,
    pageSize
  })

  return {
    report: { ...result, allowUserTagFilter: false }
  }
}

export async function syncAdminTrackingReport(event: H3Event): Promise<{
  ok: true
  fetched: number
  upserted: number
  modified: number
}> {
  const tenantDbName = normalizeAdminTenantDbQuery(event)
  if (!tenantDbName) {
    throw createError({
      statusCode: 400,
      message: 'Select a tenant before refreshing tracking'
    })
  }

  const tenants = await listAdminTrackingTenants(tenantDbName)
  if (!tenants.length) {
    throw createError({ statusCode: 403, message: 'Unknown tenant for admin tracking' })
  }

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

  const emailConfig = await resolveTenantEmailSendConfig(tenantDbName)
  let result
  if (emailConfig.provider === TENANT_EMAIL_PROVIDER_ZC_MAIL) {
    let config
    try {
      config = requireZcMailSendConfig(emailConfig)
    } catch (e: unknown) {
      throwBrevoTrackingFetchError(e instanceof Error ? e.message : String(e))
    }
    result = await syncTenantZcMailTrackingEvents({
      dbName: tenantDbName,
      config,
      fromYmd,
      toYmd,
      campaignId
    })
  } else {
    result = await syncTenantBrevoTrackingEvents({
      dbName: tenantDbName,
      marketingTenantId: tenants[0]?.marketingTenantId ?? null,
      fromYmd,
      toYmd,
      campaignId
    })
  }

  if (result.error) {
    throwBrevoTrackingFetchError(result.error)
  }

  return {
    ok: true as const,
    fetched: result.fetched,
    upserted: result.upserted,
    modified: result.modified
  }
}
