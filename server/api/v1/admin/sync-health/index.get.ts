import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { getRegistryConnection } from '@server/lib/mongoose'
import {
  ensureMarketingSyncHealthIndexes,
  getMarketingSyncWorkerHealth,
  listMarketingSyncDlqEntries,
  listMarketingSyncHealthDocs,
  listMarketingSyncHealthLogs
} from '@server/utils/marketingSyncHealth/store'
import {
  deriveMarketingSyncHealthStatus,
  type MarketingSyncDlqEntry,
  type MarketingSyncHealthDoc,
  type MarketingSyncHealthLog,
  type MarketingSyncHealthStatus,
  type MarketingSyncWorkerHealth
} from '~~/shared/marketingSyncHealth'

export type AdminSyncHealthTenantRow = MarketingSyncHealthDoc & {
  registryTenantId?: string
}

export type AdminSyncHealthResponse = {
  generatedAt: string
  worker: MarketingSyncWorkerHealth
  summary: Record<MarketingSyncHealthStatus, number>
  tenants: AdminSyncHealthTenantRow[]
  logs: MarketingSyncHealthLog[]
  dlq: MarketingSyncDlqEntry[]
}

let indexesEnsured = false

export default defineEventHandler(async (event): Promise<AdminSyncHealthResponse> => {
  assertAdminAuth(event)

  if (!indexesEnsured) {
    indexesEnsured = true
    void ensureMarketingSyncHealthIndexes().catch(() => {
      indexesEnsured = false
    })
  }

  const registry = await getRegistryConnection()
  const [clients, healthDocs, worker, logs, dlq] = await Promise.all([
    registry
      .collection('clients')
      .find({})
      .project({ _id: 1, name: 1, dbName: 1, kafkaOutboundTopic: 1 })
      .toArray(),
    listMarketingSyncHealthDocs(),
    getMarketingSyncWorkerHealth(),
    listMarketingSyncHealthLogs(),
    listMarketingSyncDlqEntries()
  ])

  const healthByKey = new Map<string, MarketingSyncHealthDoc>()
  for (const doc of healthDocs) {
    healthByKey.set(`${doc.tenantId}::${doc.dbName}`, doc)
    // Also index by dbName alone for registry merge fallback.
    if (doc.dbName) healthByKey.set(`db::${doc.dbName}`, doc)
  }

  const nowIso = new Date().toISOString()
  const tenants: AdminSyncHealthTenantRow[] = []

  for (const client of clients) {
    const dbName = typeof client.dbName === 'string' ? client.dbName.trim() : ''
    if (!dbName) continue
    const registryTenantId = client._id != null ? String(client._id) : ''
    const name = typeof client.name === 'string' ? client.name.trim() : ''
    const kafkaTopic =
      typeof client.kafkaOutboundTopic === 'string' ? client.kafkaOutboundTopic.trim() : ''

    const byTenantId = registryTenantId
      ? healthByKey.get(`${registryTenantId}::${dbName}`)
      : undefined
    const byDb = healthByKey.get(`db::${dbName}`)
    const health = byTenantId || byDb

    if (health) {
      tenants.push({
        ...health,
        tenantName: health.tenantName || name || undefined,
        kafkaTopic: health.kafkaTopic || kafkaTopic || undefined,
        registryTenantId: registryTenantId || undefined
      })
      continue
    }

    tenants.push({
      tenantId: registryTenantId,
      dbName,
      tenantName: name || undefined,
      kafkaTopic: kafkaTopic || undefined,
      status: deriveMarketingSyncHealthStatus({}),
      lastSyncMode: '',
      updatedAt: nowIso,
      registryTenantId: registryTenantId || undefined
    })
  }

  // Include orphan health docs for dbNames not in clients (e.g. renamed/removed tenants).
  const knownDbNames = new Set(tenants.map((t) => t.dbName))
  for (const doc of healthDocs) {
    if (!doc.dbName || knownDbNames.has(doc.dbName)) continue
    tenants.push({ ...doc })
  }

  const statusRank: Record<MarketingSyncHealthStatus, number> = {
    error: 0,
    degraded: 1,
    syncing: 2,
    unknown: 3,
    ok: 4
  }
  tenants.sort((a, b) => {
    const rank = statusRank[a.status] - statusRank[b.status]
    if (rank !== 0) return rank
    return (a.tenantName || a.dbName).localeCompare(b.tenantName || b.dbName)
  })

  const summary: Record<MarketingSyncHealthStatus, number> = {
    ok: 0,
    syncing: 0,
    degraded: 0,
    error: 0,
    unknown: 0
  }
  for (const row of tenants) {
    summary[row.status] += 1
  }

  return {
    generatedAt: nowIso,
    worker,
    summary,
    tenants,
    logs,
    dlq
  }
})
