import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import type { ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import type { RecipientListMemberModel } from '@server/types/tenant/recipientListMember.model'
import {
  countCampaignRecipientStatuses,
  countCampaignRecipientStatusesBatch,
  type CampaignRecipientStatusCounts
} from '@server/utils/campaignSend/recipientStatusCounts'

export type CampaignAudienceSummary = {
  recipientCount: number
  statusCounts?: CampaignRecipientStatusCounts
}

function campaignKey(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  return trimmed && mongoose.isValidObjectId(trimmed)
    ? String(new mongoose.Types.ObjectId(trimmed))
    : trimmed
}

function listKey(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  return trimmed && mongoose.isValidObjectId(trimmed)
    ? String(new mongoose.Types.ObjectId(trimmed))
    : trimmed
}

async function manualRecipientCountsByCampaign(
  ManualRecipient: ManualRecipientModel,
  campaignObjectIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  if (!campaignObjectIds.length) return new Map()
  const rows = await (ManualRecipient as ManualRecipientModel)
    .aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { campaign: { $in: campaignObjectIds } } },
      { $group: { _id: '$campaign', count: { $sum: 1 } } }
    ])
    .exec()
  return new Map(rows.map((row) => [campaignKey(String(row._id)), Number(row.count) || 0]))
}

async function listMemberCountsByListId(
  RecipientListMember: RecipientListMemberModel,
  listObjectIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  if (!listObjectIds.length) return new Map()
  const rows = await (RecipientListMember as RecipientListMemberModel)
    .aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { recipientListId: { $in: listObjectIds } } },
      { $group: { _id: '$recipientListId', count: { $sum: 1 } } }
    ])
    .exec()
  return new Map(rows.map((row) => [listKey(String(row._id)), Number(row.count) || 0]))
}

function summaryFromCounts(
  recipientCount: number,
  statusCounts?: CampaignRecipientStatusCounts
): CampaignAudienceSummary {
  return statusCounts?.total
    ? { recipientCount: statusCounts.total, statusCounts }
    : { recipientCount }
}

/** Lean audience size for one campaign (no email hydration). */
export async function resolveCampaignAudienceSummary(
  conn: Connection,
  campaign: Pick<CampaignLean, '_id' | 'recipientsType' | 'recipientsListId'>
): Promise<CampaignAudienceSummary> {
  const map = await resolveCampaignAudienceSummariesBatch(conn, [campaign])
  return map.get(campaignKey(String(campaign._id))) ?? { recipientCount: 0 }
}

/**
 * Batch audience counts for campaign list / dashboard (aggregations only).
 * Prefers `CampaignRecipient` totals when a send snapshot exists.
 */
export async function resolveCampaignAudienceSummariesBatch(
  conn: Connection,
  campaigns: Pick<CampaignLean, '_id' | 'recipientsType' | 'recipientsListId'>[]
): Promise<Map<string, CampaignAudienceSummary>> {
  const { CampaignRecipient, ManualRecipient, RecipientListMember } = getTenantClientModels(conn)
  const result = new Map<string, CampaignAudienceSummary>()
  if (!campaigns.length) return result

  const campaignIds = campaigns.map((c) => String(c._id))
  const statusCountsMap = await countCampaignRecipientStatusesBatch(
    CampaignRecipient as CampaignRecipientModel,
    campaignIds
  )

  const needsManual: typeof campaigns = []
  const needsList: typeof campaigns = []

  for (const c of campaigns) {
    const id = campaignKey(String(c._id))
    const statusCounts = statusCountsMap.get(id)
    if (statusCounts?.total) {
      result.set(id, summaryFromCounts(statusCounts.total, statusCounts))
      continue
    }
    if (c.recipientsType === 'list' && String(c.recipientsListId ?? '').trim()) {
      needsList.push(c)
    } else {
      needsManual.push(c)
    }
  }

  const manualIds = [
    ...new Set(needsManual.map((c) => String(c._id)).filter((id) => mongoose.isValidObjectId(id)))
  ].map((id) => new mongoose.Types.ObjectId(id))
  const manualCounts = await manualRecipientCountsByCampaign(
    ManualRecipient as ManualRecipientModel,
    manualIds
  )

  const listIdStrings = [
    ...new Set(
      needsList
        .map((c) => String(c.recipientsListId ?? '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]
  const listObjectIds = listIdStrings.map((id) => new mongoose.Types.ObjectId(id))
  const listCounts = await listMemberCountsByListId(
    RecipientListMember as RecipientListMemberModel,
    listObjectIds
  )

  for (const c of needsManual) {
    const id = campaignKey(String(c._id))
    result.set(id, { recipientCount: manualCounts.get(id) ?? 0 })
  }
  for (const c of needsList) {
    const id = campaignKey(String(c._id))
    const listId = listKey(String(c.recipientsListId))
    result.set(id, { recipientCount: listCounts.get(listId) ?? 0 })
  }

  return result
}

export async function resolveCampaignRecipientStatusCounts(
  conn: Connection,
  campaignId: string
): Promise<CampaignRecipientStatusCounts | null> {
  const { CampaignRecipient } = getTenantClientModels(conn)
  const counts = await countCampaignRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    campaignId
  )
  return counts.total > 0 ? counts : null
}
