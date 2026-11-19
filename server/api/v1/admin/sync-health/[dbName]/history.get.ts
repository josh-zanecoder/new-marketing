import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  listMarketingSyncDlqEntriesForTenant,
  listMarketingSyncHealthLogsForTenant
} from '@server/utils/marketingSyncHealth/store'
import {
  groupMarketingSyncRuns,
  MARKETING_SYNC_DLQ_LIMIT,
  MARKETING_SYNC_HISTORY_KINDS,
  MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT,
  MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT,
  type MarketingSyncDlqEntry,
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
  dlq: MarketingSyncDlqEntry[]
}

export default defineEventHandler(async (event): Promise<AdminTenantSyncHistoryResponse> => {
  assertAdminAuth(event)

  const dbName = decodeURIComponent(String(getRouterParam(event, 'dbName') || '')).trim()
  if (!dbName) {
    throw createError({ statusCode: 400, statusMessage: 'dbName is required' })
  }

  const query = getQuery(event)
  const rawLimit = Number(query.limit)
  const maxLimit = MARKETING_SYNC_TENANT_SYNC_HISTORY_LIMIT + MARKETING_SYNC_TENANT_CONTACT_LOG_LIMIT
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), maxLimit)
    : maxLimit

  const registry = await getRegistryConnection()
  const [client, logs, dlq] = await Promise.all([
    registry.collection('clients').findOne(
      { dbName },
      { projection: { _id: 1, name: 1, dbName: 1 } }
    ),
    listMarketingSyncHealthLogsForTenant({ dbName, limit, includeContacts: true }),
    listMarketingSyncDlqEntriesForTenant({ dbName, limit: MARKETING_SYNC_DLQ_LIMIT })
  ])

  const tenantName =
    client && typeof (client as { name?: unknown }).name === 'string'
      ? String((client as { name: string }).name).trim() || undefined
      : undefined
  const tenantId =
    client && (client as { _id?: unknown })._id != null
      ? String((client as { _id: unknown })._id)
      : undefined

  const syncLogs = logs.filter((log) => MARKETING_SYNC_HISTORY_KINDS.includes(log.kind))

  return {
    generatedAt: new Date().toISOString(),
    dbName,
    tenantName,
    tenantId,
    limit,
    logCount: logs.length,
    logs,
    runs: groupMarketingSyncRuns(syncLogs),
    dlq
  }
})
