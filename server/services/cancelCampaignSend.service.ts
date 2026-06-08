import { randomUUID } from 'node:crypto'
import { getRegistryConnection } from '../lib/mongoose'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import { removeCampaignBatchJobs } from '../queue/emailQueue'
import { getTenantConnectionByDbName } from '../tenant/connection'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { CampaignRecipientLean, CampaignRecipientModel } from '../types/tenant/campaignRecipient.model'
import {
  CAMPAIGN_RECIPIENT_NOT_SENT_STATUSES,
  CAMPAIGN_RECIPIENT_STATUS_CANCELLED,
  CAMPAIGN_RECIPIENT_STATUS_FAILED,
  CAMPAIGN_RECIPIENT_STATUS_PENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENDING,
  CAMPAIGN_RECIPIENT_STATUS_SENT,
  CAMPAIGN_STATUS_CANCELLED,
  CAMPAIGN_STATUS_PAUSED,
  CAMPAIGN_STATUS_SENDING
} from '../utils/campaignSend/constants'
import {
  countCampaignRecipientStatuses,
  countCampaignRecipientStatusesBatch,
  type CampaignRecipientStatusCounts
} from '../utils/campaignSend/recipientStatusCounts'

export type CampaignSendCancelReportCounts = CampaignRecipientStatusCounts

export type CampaignSendCancelReportRecipient = {
  email: string
  status: string
  sentAt?: string
  error?: string
}

export type CampaignSendCancelReportCampaignDetails = {
  subject: string
  senderEmail: string
  senderName: string
  ownerEmail: string
  ownerId: string
  ownerName: string
  createdBy: string
  updatedAt?: string
}

export type CampaignSendCancelReport = {
  tenantDbName: string
  tenantName: string
  campaignId: string
  campaignName: string
  campaignStatus: string
  cancelledAt: string
  counts: CampaignSendCancelReportCounts
  campaign: CampaignSendCancelReportCampaignDetails
  sentRecipients: CampaignSendCancelReportRecipient[]
  notSentRecipients: CampaignSendCancelReportRecipient[]
}

export type SendingCampaignRow = {
  tenantDbName: string
  tenantName: string
  campaignId: string
  campaignName: string
  subject: string
  senderEmail: string
  startedAt?: string
  updatedAt?: string
  counts: CampaignSendCancelReportCounts
}

export type StoppedCampaignRow = SendingCampaignRow & {
  campaignStatus: string
  ownerEmail: string
  ownerName: string
  ownerId: string
}

type TenantClientModels = ReturnType<typeof getTenantClientModels>

const DEFAULT_CANCEL_REASON = 'Cancelled by administrator'
export const ADMIN_PAUSE_REASON = 'Paused by administrator'
export const TENANT_CANCEL_REASON = 'Cancelled by user'
export const TENANT_PAUSE_REASON = 'Paused by user'
const REPORT_PREVIEW_LIMIT = 100

type StopCampaignSendOutcome = 'cancel' | 'pause'

function mapRecipientRow(r: CampaignRecipientLean): CampaignSendCancelReportRecipient {
  return {
    email: r.email,
    status: String(r.status ?? ''),
    sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
    error: r.error ? String(r.error) : undefined
  }
}

type CampaignReportSource = Pick<
  CampaignLean,
  'name' | 'status' | 'subject' | 'sender' | 'metadata' | 'mergeUserSnapshot' | 'replyTo' | 'createdBy' | 'updatedAt'
>

function mapCampaignReportDetails(campaign: CampaignReportSource): CampaignSendCancelReportCampaignDetails {
  const snap = campaign.mergeUserSnapshot
  const ownerName =
    [snap?.firstName, snap?.lastName].filter(Boolean).join(' ').trim() ||
    String(campaign.replyTo?.name ?? '').trim() ||
    String(campaign.sender?.name ?? '').trim()
  return {
    subject: String(campaign.subject ?? ''),
    senderEmail: String(campaign.sender?.email ?? ''),
    senderName: String(campaign.sender?.name ?? ''),
    ownerEmail: String(campaign.metadata?.ownerEmail ?? snap?.email ?? '').trim(),
    ownerId: String(campaign.metadata?.owner ?? campaign.createdBy ?? '').trim(),
    ownerName,
    createdBy: String(campaign.createdBy ?? '').trim(),
    updatedAt: campaign.updatedAt ? new Date(campaign.updatedAt).toISOString() : undefined
  }
}

async function loadCampaignForReport(
  Campaign: CampaignModel,
  campaignId: string
): Promise<CampaignReportSource> {
  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .select('name status subject sender metadata mergeUserSnapshot replyTo createdBy updatedAt')
    .lean<CampaignReportSource | null>()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }
  return campaign
}

export async function buildCampaignSendCancelReport(
  models: TenantClientModels,
  params: {
    tenantDbName: string
    tenantName: string
    campaignId: string
    cancelledAt?: string
  }
): Promise<CampaignSendCancelReport> {
  const { Campaign, CampaignRecipient } = models
  const campaign = await loadCampaignForReport(Campaign as CampaignModel, params.campaignId)

  const counts = await countCampaignRecipientStatuses(
    CampaignRecipient as CampaignRecipientModel,
    params.campaignId
  )
  const [sentRecipients, notSentRecipients] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel)
      .find({ campaign: params.campaignId, status: CAMPAIGN_RECIPIENT_STATUS_SENT })
      .sort({ email: 1 })
      .limit(REPORT_PREVIEW_LIMIT)
      .select('email status sentAt error')
      .lean<CampaignRecipientLean[]>(),
    (CampaignRecipient as CampaignRecipientModel)
      .find({
        campaign: params.campaignId,
        status: { $in: [...CAMPAIGN_RECIPIENT_NOT_SENT_STATUSES] }
      })
      .sort({ status: 1, email: 1 })
      .limit(REPORT_PREVIEW_LIMIT)
      .select('email status sentAt error')
      .lean<CampaignRecipientLean[]>()
  ])

  return {
    tenantDbName: params.tenantDbName,
    tenantName: params.tenantName,
    campaignId: params.campaignId,
    campaignName: String(campaign.name ?? ''),
    campaignStatus: String(campaign.status ?? ''),
    cancelledAt: params.cancelledAt ?? new Date().toISOString(),
    counts,
    campaign: mapCampaignReportDetails(campaign),
    sentRecipients: sentRecipients.map(mapRecipientRow),
    notSentRecipients: notSentRecipients.map(mapRecipientRow)
  }
}

export async function stopCampaignSend(
  models: TenantClientModels,
  campaignId: string,
  params: {
    tenantDbName: string
    tenantName: string
    reason?: string
    outcome: StopCampaignSendOutcome
  }
): Promise<CampaignSendCancelReport> {
  const reason = String(
    params.reason ??
      (params.outcome === 'pause' ? TENANT_PAUSE_REASON : DEFAULT_CANCEL_REASON)
  ).trim()
  const campaignStatus =
    params.outcome === 'pause' ? CAMPAIGN_STATUS_PAUSED : CAMPAIGN_STATUS_CANCELLED
  const { Campaign, CampaignRecipient } = models

  const campaign = await (Campaign as CampaignModel)
    .findById(campaignId)
    .select('status sendRunId name')
    .lean<Pick<CampaignLean, 'status' | 'sendRunId' | 'name'> | null>()
  if (!campaign) {
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  }
  if (campaign.status !== CAMPAIGN_STATUS_SENDING) {
    throw createError({
      statusCode: 409,
      message: `Campaign is not sending (status: ${campaign.status})`
    })
  }

  const stoppedAt = new Date().toISOString()
  const newSendRunId = randomUUID()
  const updated = await (Campaign as CampaignModel).updateOne(
    { _id: campaignId, status: CAMPAIGN_STATUS_SENDING },
    {
      $set: { status: campaignStatus, sendRunId: newSendRunId },
      $unset: { scheduledAt: 1, scheduledSendMode: 1 }
    }
  )
  if ((updated.matchedCount ?? 0) === 0) {
    throw createError({ statusCode: 409, message: 'Campaign is no longer sending' })
  }

  await (CampaignRecipient as CampaignRecipientModel).updateMany(
    {
      campaign: campaignId,
      status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] }
    },
    {
      $set: { status: CAMPAIGN_RECIPIENT_STATUS_CANCELLED, error: reason },
      $unset: { brevoMessageId: 1 }
    }
  )

  await removeCampaignBatchJobs(campaignId, params.tenantDbName)

  return buildCampaignSendCancelReport(models, {
    tenantDbName: params.tenantDbName,
    tenantName: params.tenantName,
    campaignId,
    cancelledAt: stoppedAt
  })
}

export async function pauseCampaignSend(
  models: TenantClientModels,
  campaignId: string,
  params: {
    tenantDbName: string
    tenantName: string
    reason?: string
  }
): Promise<CampaignSendCancelReport> {
  return stopCampaignSend(models, campaignId, {
    ...params,
    outcome: 'pause',
    reason: params.reason ?? TENANT_PAUSE_REASON
  })
}

export async function cancelCampaignSend(
  models: TenantClientModels,
  campaignId: string,
  params: {
    tenantDbName: string
    tenantName: string
    reason?: string
  }
): Promise<CampaignSendCancelReport> {
  return stopCampaignSend(models, campaignId, {
    ...params,
    outcome: 'cancel',
    reason: params.reason ?? DEFAULT_CANCEL_REASON
  })
}

/** Move a paused campaign to cancelled without changing the delivery ledger. */
export async function discardPausedCampaignSend(
  models: TenantClientModels,
  campaignId: string,
  params: {
    tenantDbName: string
    tenantName: string
  }
): Promise<{ ok: true; campaignId: string; campaignStatus: string }> {
  const { Campaign } = models
  const updated = await (Campaign as CampaignModel).updateOne(
    { _id: campaignId, status: CAMPAIGN_STATUS_PAUSED },
    { $set: { status: CAMPAIGN_STATUS_CANCELLED }, $unset: { scheduledAt: 1, scheduledSendMode: 1 } }
  )
  if ((updated.matchedCount ?? 0) === 0) {
    throw createError({ statusCode: 409, message: 'Campaign is not paused' })
  }
  return { ok: true, campaignId, campaignStatus: CAMPAIGN_STATUS_CANCELLED }
}

export async function listSendingCampaignsForTenant(
  tenantDbName: string,
  tenantName?: string
): Promise<SendingCampaignRow[]> {
  const dbName = String(tenantDbName ?? '').trim()
  if (!dbName) return []

  let name = String(tenantName ?? '').trim() || dbName
  if (!tenantName?.trim()) {
    const registry = await getRegistryConnection()
    const tenantRow = await registry.collection('clients').findOne({ dbName })
    if (tenantRow && typeof tenantRow.name === 'string' && tenantRow.name.trim()) {
      name = tenantRow.name.trim()
    }
  }

  let tenantConn
  try {
    tenantConn = await getTenantConnectionByDbName(dbName)
  } catch {
    return []
  }

  const models = getTenantClientModels(tenantConn)
  const { Campaign, CampaignRecipient } = models
  const sending = await (Campaign as CampaignModel)
    .find({ status: CAMPAIGN_STATUS_SENDING })
    .select('name subject sender updatedAt createdAt')
    .sort({ updatedAt: -1 })
    .lean<
      Array<
        Pick<CampaignLean, 'name' | 'subject'> & {
          _id: CampaignLean['_id']
          updatedAt?: Date
          createdAt?: Date
          sender?: { email?: string }
        }
      >
    >()

  const countsByCampaign = await countCampaignRecipientStatusesBatch(
    CampaignRecipient as CampaignRecipientModel,
    sending.map((doc) => String(doc._id))
  )

  return sending.map((doc) => {
    const campaignId = String(doc._id)
    return {
      tenantDbName: dbName,
      tenantName: name,
      campaignId,
      campaignName: String(doc.name ?? ''),
      subject: String(doc.subject ?? ''),
      senderEmail: String(doc.sender?.email ?? ''),
      startedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
      counts: countsByCampaign.get(campaignId) ?? {
        sent: 0,
        notSent: 0,
        cancelled: 0,
        pending: 0,
        failed: 0,
        sending: 0,
        total: 0
      }
    }
  })
}

const STOPPED_LIST_LIMIT = 100

export async function listStoppedCampaignsForTenant(
  tenantDbName: string,
  tenantName?: string
): Promise<StoppedCampaignRow[]> {
  const dbName = String(tenantDbName ?? '').trim()
  if (!dbName) return []

  let name = String(tenantName ?? '').trim() || dbName
  if (!tenantName?.trim()) {
    const registry = await getRegistryConnection()
    const tenantRow = await registry.collection('clients').findOne({ dbName })
    if (tenantRow && typeof tenantRow.name === 'string' && tenantRow.name.trim()) {
      name = tenantRow.name.trim()
    }
  }

  let tenantConn
  try {
    tenantConn = await getTenantConnectionByDbName(dbName)
  } catch {
    return []
  }

  const models = getTenantClientModels(tenantConn)
  const { Campaign, CampaignRecipient } = models
  const stopped = await (Campaign as CampaignModel)
    .find({ status: { $in: [CAMPAIGN_STATUS_PAUSED, CAMPAIGN_STATUS_CANCELLED] } })
    .select('name subject sender updatedAt createdAt status metadata mergeUserSnapshot replyTo createdBy')
    .sort({ updatedAt: -1 })
    .limit(STOPPED_LIST_LIMIT)
    .lean<
      Array<
        CampaignReportSource & {
          _id: CampaignLean['_id']
          createdAt?: Date
        }
      >
    >()

  const countsByCampaign = await countCampaignRecipientStatusesBatch(
    CampaignRecipient as CampaignRecipientModel,
    stopped.map((doc) => String(doc._id))
  )

  const out: StoppedCampaignRow[] = []
  for (const doc of stopped) {
    const campaignId = String(doc._id)
    const counts = countsByCampaign.get(campaignId)
    if (!counts || counts.total === 0) continue
    const details = mapCampaignReportDetails(doc)
    out.push({
      tenantDbName: dbName,
      tenantName: name,
      campaignId,
      campaignName: String(doc.name ?? ''),
      subject: details.subject,
      senderEmail: details.senderEmail,
      campaignStatus: String(doc.status ?? ''),
      ownerEmail: details.ownerEmail,
      ownerName: details.ownerName,
      ownerId: details.ownerId,
      startedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
      counts
    })
  }

  return out
}

export type AdminCampaignListPage<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

type StoppedCampaignStatusFilter = 'all' | 'Paused' | 'Cancelled'

async function resolveTenantDisplayName(
  tenantDbName: string,
  tenantName?: string
): Promise<{ dbName: string; name: string; models: TenantClientModels } | null> {
  const dbName = String(tenantDbName ?? '').trim()
  if (!dbName) return null

  let name = String(tenantName ?? '').trim() || dbName
  if (!tenantName?.trim()) {
    const registry = await getRegistryConnection()
    const tenantRow = await registry.collection('clients').findOne({ dbName })
    if (tenantRow && typeof tenantRow.name === 'string' && tenantRow.name.trim()) {
      name = tenantRow.name.trim()
    }
  }

  try {
    const tenantConn = await getTenantConnectionByDbName(dbName)
    return { dbName, name, models: getTenantClientModels(tenantConn) }
  } catch {
    return null
  }
}

export async function listSendingCampaignsForTenantPaginated(
  tenantDbName: string,
  tenantName: string | undefined,
  params: { page: number; limit: number }
): Promise<AdminCampaignListPage<SendingCampaignRow>> {
  const ctx = await resolveTenantDisplayName(tenantDbName, tenantName)
  if (!ctx) {
    return { items: [], page: 1, limit: params.limit, total: 0, totalPages: 1 }
  }

  const page = Math.max(1, params.page)
  const limit = Math.min(50, Math.max(1, params.limit))
  const { Campaign, CampaignRecipient } = ctx.models
  const filter = { status: CAMPAIGN_STATUS_SENDING }

  const [total, sending] = await Promise.all([
    (Campaign as CampaignModel).countDocuments(filter),
    (Campaign as CampaignModel)
      .find(filter)
      .select('name subject sender updatedAt createdAt')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<
        Array<
          Pick<CampaignLean, 'name' | 'subject'> & {
            _id: CampaignLean['_id']
            updatedAt?: Date
            createdAt?: Date
            sender?: { email?: string }
          }
        >
      >()
  ])

  const countsByCampaign = await countCampaignRecipientStatusesBatch(
    CampaignRecipient as CampaignRecipientModel,
    sending.map((doc) => String(doc._id))
  )

  const items: SendingCampaignRow[] = sending.map((doc) => {
    const campaignId = String(doc._id)
    return {
      tenantDbName: ctx.dbName,
      tenantName: ctx.name,
      campaignId,
      campaignName: String(doc.name ?? ''),
      subject: String(doc.subject ?? ''),
      senderEmail: String(doc.sender?.email ?? ''),
      startedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
      counts: countsByCampaign.get(campaignId) ?? {
        sent: 0,
        notSent: 0,
        cancelled: 0,
        pending: 0,
        failed: 0,
        sending: 0,
        total: 0
      }
    }
  })

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
}

export async function listStoppedCampaignsForTenantPaginated(
  tenantDbName: string,
  tenantName: string | undefined,
  params: { page: number; limit: number; status?: StoppedCampaignStatusFilter }
): Promise<AdminCampaignListPage<StoppedCampaignRow>> {
  const ctx = await resolveTenantDisplayName(tenantDbName, tenantName)
  if (!ctx) {
    return { items: [], page: 1, limit: params.limit, total: 0, totalPages: 1 }
  }

  const page = Math.max(1, params.page)
  const limit = Math.min(50, Math.max(1, params.limit))
  const statusFilter =
    params.status === 'Paused'
      ? [CAMPAIGN_STATUS_PAUSED]
      : params.status === 'Cancelled'
        ? [CAMPAIGN_STATUS_CANCELLED]
        : [CAMPAIGN_STATUS_PAUSED, CAMPAIGN_STATUS_CANCELLED]

  const { Campaign, CampaignRecipient } = ctx.models
  const recipientCampaignIds = await (CampaignRecipient as CampaignRecipientModel).distinct(
    'campaign'
  )
  const filter = {
    _id: { $in: recipientCampaignIds },
    status: { $in: statusFilter }
  }

  const [total, stopped] = await Promise.all([
    (Campaign as CampaignModel).countDocuments(filter),
    (Campaign as CampaignModel)
      .find(filter)
      .select('name subject sender updatedAt createdAt status metadata mergeUserSnapshot replyTo createdBy')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<
        Array<
          CampaignReportSource & {
            _id: CampaignLean['_id']
            createdAt?: Date
          }
        >
      >()
  ])

  const countsByCampaign = await countCampaignRecipientStatusesBatch(
    CampaignRecipient as CampaignRecipientModel,
    stopped.map((doc) => String(doc._id))
  )

  const items: StoppedCampaignRow[] = stopped.map((doc) => {
    const campaignId = String(doc._id)
    const details = mapCampaignReportDetails(doc)
    return {
      tenantDbName: ctx.dbName,
      tenantName: ctx.name,
      campaignId,
      campaignName: String(doc.name ?? ''),
      subject: details.subject,
      senderEmail: details.senderEmail,
      campaignStatus: String(doc.status ?? ''),
      ownerEmail: details.ownerEmail,
      ownerName: details.ownerName,
      ownerId: details.ownerId,
      startedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined,
      counts: countsByCampaign.get(campaignId) ?? {
        sent: 0,
        notSent: 0,
        cancelled: 0,
        pending: 0,
        failed: 0,
        sending: 0,
        total: 0
      }
    }
  })

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
}

export async function listSendingCampaignsAcrossTenants(): Promise<SendingCampaignRow[]> {
  const registry = await getRegistryConnection()
  const rows = await registry
    .collection('clients')
    .find({})
    .project({ dbName: 1, name: 1 })
    .toArray()

  const out: SendingCampaignRow[] = []

  for (const row of rows) {
    const tenantDbName = typeof row.dbName === 'string' ? row.dbName.trim() : ''
    if (!tenantDbName) continue
    const tenantName = typeof row.name === 'string' ? row.name.trim() : tenantDbName
    const tenantCampaigns = await listSendingCampaignsForTenant(tenantDbName, tenantName)
    out.push(...tenantCampaigns)
  }

  out.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
  return out
}

export async function cancelAllSendingCampaignsForTenant(
  tenantDbName: string,
  tenantName: string,
  params?: { reason?: string }
): Promise<CampaignSendCancelReport[]> {
  const rows = await listSendingCampaignsForTenant(tenantDbName, tenantName)
  const reports: CampaignSendCancelReport[] = []

  const tenantConn = await getTenantConnectionByDbName(tenantDbName)
  const models = getTenantClientModels(tenantConn)

  for (const row of rows) {
    try {
      const report = await cancelCampaignSend(models, row.campaignId, {
        tenantDbName: row.tenantDbName,
        tenantName: row.tenantName,
        reason: params?.reason
      })
      reports.push(report)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[CancelCampaignSend] skip campaign during tenant cancel-all', {
        tenantDbName: row.tenantDbName,
        campaignId: row.campaignId,
        message
      })
    }
  }

  return reports
}

export async function cancelAllSendingCampaigns(params?: {
  reason?: string
}): Promise<CampaignSendCancelReport[]> {
  const rows = await listSendingCampaignsAcrossTenants()
  const reports: CampaignSendCancelReport[] = []

  for (const row of rows) {
    const tenantConn = await getTenantConnectionByDbName(row.tenantDbName)
    const models = getTenantClientModels(tenantConn)
    try {
      const report = await cancelCampaignSend(models, row.campaignId, {
        tenantDbName: row.tenantDbName,
        tenantName: row.tenantName,
        reason: params?.reason
      })
      reports.push(report)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[CancelCampaignSend] skip campaign during cancel-all', {
        tenantDbName: row.tenantDbName,
        campaignId: row.campaignId,
        message
      })
    }
  }

  return reports
}

export type CampaignSendReportRecipientFilter =
  | 'all'
  | 'sent'
  | 'notSent'
  | 'pending'
  | 'failed'
  | 'cancelled'

function recipientFilterForStatus(
  filter: CampaignSendReportRecipientFilter
): Record<string, unknown> | null {
  if (filter === 'sent') return { status: CAMPAIGN_RECIPIENT_STATUS_SENT }
  if (filter === 'failed') return { status: CAMPAIGN_RECIPIENT_STATUS_FAILED }
  if (filter === 'cancelled') return { status: CAMPAIGN_RECIPIENT_STATUS_CANCELLED }
  if (filter === 'pending') {
    return { status: { $in: [CAMPAIGN_RECIPIENT_STATUS_PENDING, CAMPAIGN_RECIPIENT_STATUS_SENDING] } }
  }
  if (filter === 'notSent') return { status: { $in: [...CAMPAIGN_RECIPIENT_NOT_SENT_STATUSES] } }
  return null
}

export async function getCampaignSendReportRecipients(
  models: TenantClientModels,
  params: {
    campaignId: string
    filter: CampaignSendReportRecipientFilter
    page: number
    limit: number
    search?: string
  }
): Promise<{
  campaignId: string
  filter: CampaignSendReportRecipientFilter
  page: number
  limit: number
  total: number
  totalPages: number
  counts: CampaignSendCancelReportCounts
  items: CampaignSendCancelReportRecipient[]
}> {
  const { CampaignRecipient } = models
  const baseFilter: Record<string, unknown> = { campaign: params.campaignId }
  const statusFilter = recipientFilterForStatus(params.filter)
  if (statusFilter) Object.assign(baseFilter, statusFilter)

  const search = String(params.search ?? '').trim()
  if (search) {
    baseFilter.email = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i'
    }
  }

  const page = Math.max(1, params.page)
  const limit = Math.min(200, Math.max(1, params.limit))
  const [items, total, counts] = await Promise.all([
    (CampaignRecipient as CampaignRecipientModel)
      .find(baseFilter)
      .sort({ status: 1, email: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('email status sentAt error')
      .lean<CampaignRecipientLean[]>(),
    (CampaignRecipient as CampaignRecipientModel).countDocuments(baseFilter),
    countCampaignRecipientStatuses(CampaignRecipient as CampaignRecipientModel, params.campaignId)
  ])

  return {
    campaignId: params.campaignId,
    filter: params.filter,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
    items: items.map(mapRecipientRow)
  }
}

export async function getCampaignSendCancelReportPaginated(
  models: TenantClientModels,
  params: {
    tenantDbName: string
    tenantName: string
    campaignId: string
    group: 'sent' | 'notSent'
    page: number
    limit: number
    search?: string
  }
): Promise<{
  campaignId: string
  group: 'sent' | 'notSent'
  page: number
  limit: number
  total: number
  totalPages: number
  items: CampaignSendCancelReportRecipient[]
}> {
  const result = await getCampaignSendReportRecipients(models, {
    campaignId: params.campaignId,
    filter: params.group,
    page: params.page,
    limit: params.limit,
    search: params.search
  })
  return {
    campaignId: result.campaignId,
    group: params.group,
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
    items: result.items
  }
}
