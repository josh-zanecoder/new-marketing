import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import {
  enqueueCampaignBatch,
  hasActiveCampaignSendJob
} from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import { finalizeCampaignSendIfComplete } from './send-campaign.service'

/**
 * Safety net for campaigns stuck in `Sending`:
 * - No pending recipients → finalize to Sent/Failed
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
      .select('_id updatedAt')
      .lean<Array<Pick<CampaignLean, '_id' | 'updatedAt'>>>()

    for (const doc of stuck) {
      const campaignId = String(doc._id)
      try {
        const pendingCount = await (CampaignRecipient as CampaignRecipientModel).countDocuments({
          campaign: campaignId,
          status: 'pending'
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

        const activeJob = await hasActiveCampaignSendJob(campaignId, dbName)
        if (activeJob) continue

        await enqueueCampaignBatch(campaignId, dbName)
        requeued++
        console.log('[SendingReconcile] re-enqueued stuck batch', {
          dbName,
          campaignId,
          pending: pendingCount,
          updatedAt: doc.updatedAt
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn('[SendingReconcile] skip or failed', { dbName, campaignId, message })
      }
    }
  }

  if (finalized || requeued) {
    console.log('[SendingReconcile] summary', { finalized, requeued })
  }
}
