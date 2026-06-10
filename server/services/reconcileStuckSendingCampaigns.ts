import { randomUUID } from 'node:crypto'
import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import {
  enqueueCampaignBatchFanOut,
  hasActiveCampaignSendJob
} from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import {
  ackStaleInFlightSendingRecipients,
  clearStaleSendingRecipients,
  finalizeCampaignSendIfComplete
} from './send-campaign.service'
import { countOutstandingSendWork } from '../utils/campaignSend/countRecipientStatuses'

/**
 * Safety net for campaigns stuck in `Sending`:
 * - Clear stale `sending` recipients → failed (retryable)
 * - No pending/sending recipients → finalize to Sent/Failed
 * - Pending recipients but no queue job → re-enqueue batch processing
 */
export async function reconcileStuckSendingCampaigns(): Promise<void> {
  const registry = await getRegistryConnection()
  const rows = await registry
    .collection('clients')
    .find({})
    .project({ dbName: 1 })
    .toArray()

  let finalized = 0
  let requeued = 0
  let staleCleared = 0

  for (const row of rows) {
    const dbName = typeof row.dbName === 'string' ? row.dbName.trim() : ''
    if (!dbName) continue

    let tenantConn
    try {
      tenantConn = await getTenantConnectionByDbName(dbName)
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

        const outstanding = await countOutstandingSendWork(
          CampaignRecipient as CampaignRecipientModel,
          campaignId
        )

        if (outstanding === 0) {
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

        await enqueueCampaignBatchFanOut({
          campaignId,
          dbName,
          sendRunId,
          startPage: 0,
          pendingEstimate: outstanding
        })
        requeued++
        console.log('[SendingReconcile] re-enqueued stuck batch', {
          dbName,
          campaignId,
          sendRunId,
          outstanding,
          updatedAt: doc.updatedAt
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('[SendingReconcile] skip or failed', { dbName, campaignId, message })
      }
    }
  }

  if (finalized || requeued || staleCleared) {
    console.log('[SendingReconcile] summary', { finalized, requeued, staleCleared })
  }
}
