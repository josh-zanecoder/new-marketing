import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import { removeScheduledCampaignJob } from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { beginCampaignSend } from './send-campaign.service'

/**
 * Picks up Scheduled campaigns whose time has passed but never left Mongo
 * (e.g. delayed BullMQ job evicted from Redis, dev server restart, wrong Redis).
 */
export async function reconcileOverdueScheduledCampaigns(): Promise<void> {
  const registry = await getRegistryConnection()
  const rows = await registry
    .collection('clients')
    .find({})
    .project({ dbName: 1 })
    .toArray()

  const now = new Date()
  let started = 0

  for (const row of rows) {
    const dbName = typeof row.dbName === 'string' ? row.dbName.trim() : ''
    if (!dbName) continue

    let tenantConn
    try {
      tenantConn = await getTenantConnectionByDbName(dbName)
    } catch {
      continue
    }

    const { Campaign } = getTenantClientModels(tenantConn)
    const overdue = await (Campaign as CampaignModel)
      .find({
        status: 'Scheduled',
        scheduledAt: { $lte: now }
      })
      .select('_id')
      .lean<Array<Pick<CampaignLean, '_id'>>>()

    for (const doc of overdue) {
      const campaignId = String(doc._id)
      try {
        await removeScheduledCampaignJob(dbName, campaignId)
        await beginCampaignSend(tenantConn, campaignId, {
          allowedStatuses: ['Scheduled'],
          statusOnEnqueueFailure: 'Scheduled'
        })
        started++
        console.log('[ScheduleReconcile] started overdue send', { dbName, campaignId })
      } catch (err: unknown) {
        let msg = err instanceof Error ? err.message : String(err)
        if (err && typeof err === 'object') {
          const o = err as { statusMessage?: string; message?: string; data?: { message?: string } }
          if (typeof o.statusMessage === 'string') msg = o.statusMessage
          else if (typeof o.message === 'string') msg = o.message
          else if (typeof o.data?.message === 'string') msg = o.data.message
        }
        console.warn('[ScheduleReconcile] skip or failed', { dbName, campaignId, message: msg })
      }
    }
  }

  if (started) {
    console.log(`[ScheduleReconcile] started ${started} overdue scheduled campaign(s)`)
  }
}
