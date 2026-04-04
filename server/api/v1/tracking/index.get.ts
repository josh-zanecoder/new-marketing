import type { H3Event } from 'h3'
import { getTransactionalEmailEventReport } from '@server/services/brevo.service'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'

function parseTagSegments(tagStr: string | undefined): string[] {
  if (!tagStr?.trim()) return []
  return tagStr.split(',').map((p) => p.trim()).filter(Boolean)
}

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i

function normalizeCampaignIdQuery(event: H3Event): string | null {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.campaignId
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  if (!s || !MONGO_OBJECT_ID_RE.test(s)) return null
  return s
}

function eventTagMatchesTenant(
  tagStr: string | undefined,
  dbName: string,
  marketingTenantId: string | null
): boolean {
  const parts = parseTagSegments(tagStr)
  const dbToken = `db:${dbName}`
  if (parts.includes(dbToken)) return true
  if (marketingTenantId) {
    const tenantToken = `tenant:${marketingTenantId}`
    if (parts.includes(tenantToken)) return true
  }
  return false
}

function eventTagMatchesCampaign(tagStr: string | undefined, campaignId: string): boolean {
  return parseTagSegments(tagStr).includes(`campaign:${campaignId}`)
}

function filterReportEventsForTenant(
  report: unknown,
  dbName: string,
  marketingTenantId: string | null,
  campaignId: string | null
): unknown {
  if (report == null || typeof report !== 'object') return report
  const r = report as { events?: unknown }
  const raw = r.events
  if (!Array.isArray(raw)) {
    return { ...r, events: [] }
  }
  const events = raw.filter((item) => {
    if (item == null || typeof item !== 'object') return false
    const tag = (item as { tag?: string }).tag
    if (!eventTagMatchesTenant(tag, dbName, marketingTenantId)) return false
    if (campaignId && !eventTagMatchesCampaign(tag, campaignId)) return false
    return true
  })
  return { ...r, events }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Tenant session required for tracking'
    })
  }

  const tenantAuth = auth as RegisteredTenantAuthContext
  const dbName = tenantAuth.dbName.trim()
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing tenant database context' })
  }

  const registryConn = await getRegistryConnection()
  const marketingTenantId = await resolveTenantIdForTenantAuth(registryConn, tenantAuth)

  const { report, error } = await getTransactionalEmailEventReport({})
  if (error) {
    throw createError({ statusCode: 502, statusMessage: error })
  }

  const campaignId = normalizeCampaignIdQuery(event)
  const filteredReport = filterReportEventsForTenant(
    report,
    dbName,
    marketingTenantId,
    campaignId
  )

  return { report: filteredReport }
})
