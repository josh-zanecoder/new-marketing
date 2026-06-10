import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type {
  CampaignRecipientInsertRow,
  CampaignRecipientModel
} from '@server/types/tenant/campaignRecipient.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import type { RecipientListMemberModel } from '@server/types/tenant/recipientListMember.model'
import { isValidMarketingEmail, normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import { enqueueCampaignBatchFanOut } from '@server/queue/emailQueue'
import { removeCampaignBatchCloudTasks } from '@server/queue/campaignCloudTasksQueue'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { recipientEmailsForCampaign } from '@server/utils/emailMerge/campaignAudience'

const INSERT_BATCH_SIZE = Math.max(
  500,
  Math.min(5000, Number(process.env.CAMPAIGN_SEND_RECIPIENT_INSERT_BATCH) || 2000)
)

export type CampaignPrepareJobData = {
  campaignId: string
  dbName: string
  sendRunId: string
  mode: 'new' | 'resend_all'
  revertStatus?: string
}

function logPrepare(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignSendPrepare] ${event}`, details)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function insertRecipientRows(
  CampaignRecipient: CampaignRecipientModel,
  rows: CampaignRecipientInsertRow[]
): Promise<void> {
  if (!rows.length) return
  const batches = chunk(rows, INSERT_BATCH_SIZE)
  await Promise.all(
    batches.map((batch) =>
      (CampaignRecipient as CampaignRecipientModel).insertMany(batch, { ordered: false })
    )
  )
}

/** List campaigns: resolve members → contacts in batches and insert without one giant email array. */
async function materializeListCampaignRecipients(
  conn: Connection,
  campaign: CampaignLean,
  campaignId: string
): Promise<{ total: number; valid: number; invalid: number }> {
  const listIdRaw = String(campaign.recipientsListId ?? '').trim()
  if (!mongoose.isValidObjectId(listIdRaw)) {
    return { total: 0, valid: 0, invalid: 0 }
  }

  const listId = new mongoose.Types.ObjectId(listIdRaw)
  const { RecipientListMember, Contact, CampaignRecipient } = getTenantClientModels(conn)

  type MemberLean = { contactId?: mongoose.Types.ObjectId }
  const members = await (RecipientListMember as RecipientListMemberModel)
    .find({ recipientListId: listId })
    .select('contactId')
    .lean<MemberLean[]>()

  const contactIds = members.map((m) => m.contactId).filter(Boolean) as mongoose.Types.ObjectId[]
  const seenContacts = new Set<string>()
  const uniqueContactIds: mongoose.Types.ObjectId[] = []
  for (const id of contactIds) {
    const key = String(id)
    if (seenContacts.has(key)) continue
    seenContacts.add(key)
    uniqueContactIds.push(id)
  }

  let valid = 0
  let invalid = 0

  for (const idBatch of chunk(uniqueContactIds, INSERT_BATCH_SIZE)) {
    const contacts = await (Contact as ContactModel)
      .find(withMarketableContactFilter({ _id: { $in: idBatch } }))
      .select('email')
      .lean<ContactLean[]>()

    const rows: CampaignRecipientInsertRow[] = []
    const seenEmails = new Set<string>()
    for (const contact of contacts) {
      const email = normalizeMarketingEmail(contact.email)
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      if (isValidMarketingEmail(email)) {
        rows.push({
          campaign: campaignId,
          email,
          status: 'pending',
          clientId: ''
        })
      } else {
        rows.push({
          campaign: campaignId,
          email,
          status: 'failed',
          clientId: '',
          error: 'Invalid email address'
        })
      }
    }

    if (rows.length) {
      await insertRecipientRows(CampaignRecipient as CampaignRecipientModel, rows)
      valid += rows.filter((r) => r.status === 'pending').length
      invalid += rows.filter((r) => r.status === 'failed').length
    }
  }

  return { total: valid + invalid, valid, invalid }
}

async function materializeManualCampaignRecipients(
  conn: Connection,
  campaign: CampaignLean,
  campaignId: string
): Promise<{ total: number; valid: number; invalid: number }> {
  const { ManualRecipient, Contact, CampaignRecipient } = getTenantClientModels(conn)

  const docs = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: campaign._id })
    .select('contact')
    .lean<ManualRecipientLean[]>()

  const contactIds = docs.map((r) => r.contact).filter(Boolean) as mongoose.Types.ObjectId[]
  const seenContacts = new Set<string>()
  const uniqueContactIds: mongoose.Types.ObjectId[] = []
  for (const id of contactIds) {
    const key = String(id)
    if (seenContacts.has(key)) continue
    seenContacts.add(key)
    uniqueContactIds.push(id)
  }

  let valid = 0
  let invalid = 0

  for (const idBatch of chunk(uniqueContactIds, INSERT_BATCH_SIZE)) {
    const contacts = await (Contact as ContactModel)
      .find(withMarketableContactFilter({ _id: { $in: idBatch } }))
      .select('email')
      .lean<ContactLean[]>()

    const rows: CampaignRecipientInsertRow[] = []
    const seenEmails = new Set<string>()
    for (const contact of contacts) {
      const email = normalizeMarketingEmail(contact.email)
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      if (isValidMarketingEmail(email)) {
        rows.push({
          campaign: campaignId,
          email,
          status: 'pending',
          clientId: ''
        })
      } else {
        rows.push({
          campaign: campaignId,
          email,
          status: 'failed',
          clientId: '',
          error: 'Invalid email address'
        })
      }
    }

    if (rows.length) {
      await insertRecipientRows(CampaignRecipient as CampaignRecipientModel, rows)
      valid += rows.filter((r) => r.status === 'pending').length
      invalid += rows.filter((r) => r.status === 'failed').length
    }
  }

  return { total: valid + invalid, valid, invalid }
}

async function materializeCampaignRecipients(
  conn: Connection,
  campaign: CampaignLean,
  campaignId: string
): Promise<{ total: number; valid: number; invalid: number }> {
  if (campaign.recipientsType === 'list' && String(campaign.recipientsListId ?? '').trim()) {
    return materializeListCampaignRecipients(conn, campaign, campaignId)
  }
  if (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list') {
    return materializeManualCampaignRecipients(conn, campaign, campaignId)
  }

  const emails = await recipientEmailsForCampaign(conn, campaign)
  const { CampaignRecipient } = getTenantClientModels(conn)
  const rows: CampaignRecipientInsertRow[] = []
  for (const raw of emails) {
    const email = String(raw ?? '').trim()
    if (!email) continue
    if (isValidMarketingEmail(email)) {
      rows.push({ campaign: campaignId, email, status: 'pending', clientId: '' })
    } else {
      rows.push({
        campaign: campaignId,
        email,
        status: 'failed',
        clientId: '',
        error: 'Invalid email address'
      })
    }
  }
  await insertRecipientRows(CampaignRecipient as CampaignRecipientModel, rows)
  const valid = rows.filter((r) => r.status === 'pending').length
  const invalid = rows.filter((r) => r.status === 'failed').length
  return { total: rows.length, valid, invalid }
}

/**
 * Background step: build recipient ledger rows and fan out batch workers.
 * Called from the prepare Cloud Task after the send API returns.
 */
export async function materializeCampaignRecipientsAndEnqueue(
  conn: Connection,
  data: CampaignPrepareJobData
): Promise<{ valid: number; invalid: number; total: number }> {
  const { campaignId, dbName, sendRunId, mode } = data
  const revertStatus = data.revertStatus ?? 'Draft'
  const startedAt = Date.now()

  const models = getTenantClientModels(conn)
  const { Campaign, CampaignRecipient } = models

  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) {
    throw new Error('Campaign not found during prepare')
  }
  if (String(campaign.sendRunId || '') !== sendRunId || campaign.status !== 'Sending') {
    logPrepare('skip.staleRun', {
      campaignId,
      dbName,
      sendRunId,
      campaignSendRunId: campaign.sendRunId,
      status: campaign.status
    })
    return { valid: 0, invalid: 0, total: 0 }
  }

  logPrepare('start', { campaignId, dbName, sendRunId, mode })

  if (mode === 'resend_all') {
    await removeCampaignBatchCloudTasks(campaignId, dbName)
  }

  await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })
  const { total, valid, invalid } = await materializeCampaignRecipients(conn, campaign, campaignId)

  if (valid === 0) {
    await (Campaign as CampaignModel).updateOne(
      { _id: campaignId, sendRunId },
      { $set: { status: 'Failed' }, $unset: { scheduledAt: 1 } }
    )
    logPrepare('noValidRecipients', { campaignId, dbName, total, invalid, ms: Date.now() - startedAt })
    return { total, valid, invalid }
  }

  try {
    await enqueueCampaignBatchFanOut({
      campaignId,
      dbName,
      sendRunId,
      startPage: 0,
      pendingEstimate: valid
    })
  } catch (e: unknown) {
    await (CampaignRecipient as CampaignRecipientModel).deleteMany({ campaign: campaignId })
    await (Campaign as CampaignModel).updateOne(
      { _id: campaignId, sendRunId },
      { $set: { status: revertStatus } }
    )
    logPrepare('enqueueFailed', {
      campaignId,
      dbName,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - startedAt
    })
    throw e
  }

  logPrepare('done', {
    campaignId,
    dbName,
    sendRunId,
    mode,
    valid,
    invalid,
    total,
    ms: Date.now() - startedAt
  })
  return { total, valid, invalid }
}
