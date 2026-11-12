import {
  CAMPAIGN_RECONCILE_TENANT_YIELD_MS,
  resolveCampaignReconcileTenantBatchSize
} from '../constants/campaignReconcile'
import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import { hasActiveCampaignSendJob, removeScheduledCampaignJob } from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { withCampaignReconcileGate } from '../utils/campaignSend/campaignReconcileGate'
import { takeReconcileTenantDbNameBatch } from '../utils/campaignSend/reconcileTenantBatch'
import { beginCampaignSend } from './send-campaign.service'

/** Round-robin cursor across reconcile ticks (per process). */
const scheduleReconcileCursor = { index: 0 }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Picks up Scheduled campaigns whose time has passed but never left Mongo
 * (e.g. delayed BullMQ job evicted from Redis, dev server restart, wrong Redis).
 *
 * Processes a rotating tenant batch each tick so the shared Mongo pool
 * stays available for webhooks / UI.
 */
export async function reconcileOverdueScheduledCampaigns(): Promise<void> {
  await withCampaignReconcileGate('ScheduleReconcile', async () => {
    const registry = await getRegistryConnection()
    const rows = await registry
      .collection('clients')
      .find({})
      .project({ dbName: 1 })
      .toArray()

    const allDbNames = rows
      .map((row) => (typeof row.dbName === 'string' ? row.dbName.trim() : ''))
      .filter(Boolean)
    const batch = takeReconcileTenantDbNameBatch(
      allDbNames,
      resolveCampaignReconcileTenantBatchSize(),
      scheduleReconcileCursor
    )

    const now = new Date()
    let started = 0

    for (const dbName of batch) {
      let tenantConn
      try {
        tenantConn = await getTenantConnectionByDbName(dbName, { verifyWithPing: false })
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
          // Drop the delayed schedule trigger first. A retrying/stuck Cloud Task must
          // not keep status=Scheduled forever (hasActive used to treat it as "sending").
          const removed = await removeScheduledCampaignJob(dbName, campaignId)
          if (!removed.removed && (removed.reason === 'active' || removed.reason === 'locked')) {
            console.log('[ScheduleReconcile] skip (scheduled job in flight)', {
              dbName,
              campaignId,
              reason: removed.reason,
              state: removed.state
            })
            continue
          }

          if (await hasActiveCampaignSendJob(campaignId, dbName)) {
            console.log('[ScheduleReconcile] skip (queue job already active)', {
              dbName,
              campaignId
            })
            continue
          }

          await beginCampaignSend(tenantConn, campaignId, {
            allowedStatuses: ['Scheduled'],
            statusOnEnqueueFailure: 'Scheduled',
            awaitUnsubscribeApproval: false
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

      await sleep(CAMPAIGN_RECONCILE_TENANT_YIELD_MS)
    }

    if (started) {
      console.log('[ScheduleReconcile] started overdue scheduled campaign(s)', {
        started,
        tenantsScanned: batch.length,
        tenantsTotal: allDbNames.length
      })
    }
  })
}
