import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { getRegistryConnection } from '@server/lib/mongoose'
import { listMarketingSyncHealthLogsForTenant } from '@server/utils/marketingSyncHealth/store'
import {
  groupMarketingSyncRuns,
  MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT,
  type MarketingSyncHealthLog,
  type MarketingSyncRunSummary
} from '~~/shared/marketingSyncHealth'

export type AdminTenantSyncHistoryResponse = {
  generatedAt: string
  dbName: string
  tenantName?: string
  tenantId?: string
  limit: number
  logCount: number
  logs: MarketingSyncHealthLog[]
  runs: MarketingSyncRunSummary[]
}

export default defineEventHandler(async (event): Promise<AdminTenantSyncHistoryResponse> => {
  assertAdminAuth(event)

  const dbName = decodeURIComponent(String(getRouterParam(event, 'dbName') || '')).trim()
  if (!dbName) {
    throw createError({ statusCode: 400, statusMessage: 'dbName is required' })
  }

  const query = getQuery(event)
  const rawLimit = Number(query.limit)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT)
    : MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT

  const registry = await getRegistryConnection()
  const [client, logs] = await Promise.all([
    registry.collection('clients').findOne(
      { dbName },
      { projection: { _id: 1, name: 1, dbName: 1 } }
    ),
    listMarketingSyncHealthLogsForTenant({ dbName, limit })
  ])

  const tenantName =
    client && typeof (client as { name?: unknown }).name === 'string'
      ? String((client as { name: string }).name).trim() || undefined
      : undefined
  const tenantId =
    client && (client as { _id?: unknown })._id != null
      ? String((client as { _id: unknown })._id)
      : undefined

  return {
    generatedAt: new Date().toISOString(),
    dbName,
    tenantName,
    tenantId,
    limit,
    logCount: logs.length,
    logs,
    runs: groupMarketingSyncRuns(logs)
  }
})
