import { randomUUID } from 'node:crypto'
import {
  CAMPAIGN_RECONCILE_TENANT_YIELD_MS,
  resolveCampaignReconcileTenantBatchSize
} from '../constants/campaignReconcile'
import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import {
  enqueueCampaignBatch,
  hasActiveCampaignSendJob
} from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { withCampaignReconcileGate } from '../utils/campaignSend/campaignReconcileGate'
import { takeReconcileTenantDbNameBatch } from '../utils/campaignSend/reconcileTenantBatch'
import {
  ackStaleInFlightSendingRecipients,
  clearStaleSendingRecipients,
  finalizeCampaignSendIfComplete
} from './send-campaign.service'
import {
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING
} from '../utils/campaignSend/constants'

/** Round-robin cursor across reconcile ticks (per process). */
const sendingReconcileCursor = { index: 0 }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Safety net for campaigns stuck in `Sending`:
 * - Clear stale `sending` recipients → failed (retryable)
 * - No pending/sending recipients → finalize to Sent/Failed
 * - Pending recipients but no queue job → re-enqueue batch processing
 *
 * Processes a rotating tenant batch each tick so the shared Mongo pool
 * stays available for webhooks / UI.
 */
export async function reconcileStuckSendingCampaigns(): Promise<void> {
  await withCampaignReconcileGate('SendingReconcile', async () => {
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
      sendingReconcileCursor
    )

    let finalized = 0
    let requeued = 0
    let staleCleared = 0

    for (const dbName of batch) {
      let tenantConn
      try {
        tenantConn = await getTenantConnectionByDbName(dbName, { verifyWithPing: false })
      } catch {
        continue
      }

      const models = getTenantClientModels(tenantConn)
      const { Campaign, CampaignRecipient } = models

      const stuck = await (Campaign as CampaignModel)
        .find({ status: 'Sending' })
        .select('_id updatedAt sendRunId')
        .lean<Array<Pick<CampaignLean, '_id' | 'updatedAt' | 'sendRunId'>>>()

      for (const doc of stuck) {
        const campaignId = String(doc._id)
        try {
          const cleared = await clearStaleSendingRecipients(models, campaignId)
          if (cleared > 0) staleCleared += cleared

          const activeJob = await hasActiveCampaignSendJob(campaignId, dbName)
          if (!activeJob) {
            const acked = await ackStaleInFlightSendingRecipients(models, campaignId)
            if (acked > 0) staleCleared += acked
          }

          const pendingCount = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
            campaign: campaignId,
            status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
          })

          if (pendingCount === 0) {
            const result = await finalizeCampaignSendIfComplete(models, campaignId)
            if (result.finalized) {
              finalized++
              console.log('[SendingReconcile] finalized idle Sending campaign', {
                dbName,
                campaignId,
                status: result.status
              })
            }
            continue
          }

          if (activeJob) continue

          let sendRunId = String(doc.sendRunId || '').trim()
          if (!sendRunId) {
            sendRunId = randomUUID()
            await (Campaign as CampaignModel).updateOne(
              { _id: campaignId },
              { $set: { sendRunId, sendPage: 0 } }
            )
            console.log('[SendingReconcile] assigned sendRunId for legacy Sending campaign', {
              dbName,
              campaignId,
              sendRunId
            })
          }

          await enqueueCampaignBatch({
            campaignId,
            dbName,
            sendRunId,
            page: 0
          })
          requeued++
          console.log('[SendingReconcile] re-enqueued stuck batch', {
            dbName,
            campaignId,
            sendRunId,
            pending: pendingCount,
            updatedAt: doc.updatedAt
          })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn('[SendingReconcile] skip or failed', { dbName, campaignId, message })
        }
      }

      await sleep(CAMPAIGN_RECONCILE_TENANT_YIELD_MS)
    }

    if (finalized || requeued || staleCleared) {
      console.log('[SendingReconcile] summary', {
        finalized,
        requeued,
        staleCleared,
        tenantsScanned: batch.length,
        tenantsTotal: allDbNames.length
      })
    }
  })
}
