/**
 * Resolves who a campaign targets (emails) and loads CRM `Contact` rows for merge + send.
 * Used by queue send, merge-root preview, and send API.
 */
import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import type { TenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '@server/types/tenant/campaign.model'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import type { ManualRecipientLean, ManualRecipientModel } from '@server/types/tenant/manualRecipient.model'
import type { RecipientListMemberModel } from '@server/types/tenant/recipientListMember.model'
import { normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { resolveRecipientListEmails } from '@server/utils/recipient/resolveRecipientListEmails'

function contactKindRank(k: string): number {
  const order: Record<string, number> = { client: 0, prospect: 1, contact: 2 }
  return order[k] ?? 3
}

function pickPreferredContact(a: ContactLean, b: ContactLean): ContactLean {
  const ra = contactKindRank(a.contactKind)
  const rb = contactKindRank(b.contactKind)
  if (ra !== rb) return ra < rb ? a : b
  const ta = a.updatedAt?.getTime() ?? 0
  const tb = b.updatedAt?.getTime() ?? 0
  return ta >= tb ? a : b
}

async function loadContactsByNormalizedEmail(
  Contact: ContactModel,
  emails: string[]
): Promise<Map<string, ContactLean>> {
  const normalized = [...new Set(emails.map((e) => normalizeMarketingEmail(e)).filter(Boolean))]
  if (!normalized.length) return new Map()
  const docs = await Contact.find({
    deletedAt: null,
    email: { $in: normalized }
  })
    .lean<ContactLean[]>()
  const map = new Map<string, ContactLean>()
  for (const c of docs) {
    const key = normalizeMarketingEmail(c.email)
    if (!key) continue
    const prev = map.get(key)
    map.set(key, prev ? pickPreferredContact(prev, c) : c)
  }
  return map
}

function mergeListMemberContactsIntoMap(
  map: Map<string, ContactLean>,
  listContacts: ContactLean[]
): void {
  for (const c of listContacts) {
    const key = normalizeMarketingEmail(c.email)
    if (!key) continue
    const prev = map.get(key)
    map.set(key, prev ? pickPreferredContact(prev, c) : c)
  }
}

/** Subset of campaign fields that affect how we resolve contacts for a list vs manual audience. */
export type CampaignAudienceConfig = Pick<CampaignLean, 'recipientsType' | 'recipientsListId'>

export type DraftRecipientContext = {
  recipientsType: 'list' | 'manual'
  recipientsListId?: string
  /** Manual draft: Contact `_id` strings (not emails). */
  recipientsManual?: string[]
}

/** Ordered, deduped recipient emails for a saved campaign (same rules as send queue). */
export async function recipientEmailsForCampaign(
  conn: Connection,
  campaign: CampaignLean
): Promise<string[]> {
  const { ManualRecipient, Contact } = getTenantClientModels(conn)
  if (campaign.recipientsType === 'list' && campaign.recipientsListId?.trim()) {
    const fromList = await resolveRecipientListEmails(conn, campaign.recipientsListId)
    return [
      ...new Set(
        fromList.map((e) => normalizeMarketingEmail(e)).filter((e): e is string => !!e)
      )
    ]
  }
  const manualDocs = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: campaign._id })
    .lean<ManualRecipientLean[]>()
  const idStrings = manualDocs
    .map((r) => String(r.contact ?? ''))
    .filter((id) => mongoose.isValidObjectId(id))
  const uniqueIds = [...new Set(idStrings)].map((s) => new mongoose.Types.ObjectId(s))
  if (!uniqueIds.length) return []
  const contacts = await (Contact as ContactModel)
    .find({ _id: { $in: uniqueIds }, deletedAt: null })
    .select('email')
    .lean<ContactLean[]>()
  const emailById = new Map(
    contacts.map((c) => [String(c._id), normalizeMarketingEmail(c.email)])
  )
  return [
    ...new Set(
      manualDocs
        .map((r) => emailById.get(String(r.contact)))
        .filter((e): e is string => !!e)
    )
  ]
}

/** Recipient emails for an unsaved draft (wizard) using the same list vs manual rules. */
export async function recipientEmailsForDraft(
  conn: Connection,
  draft: DraftRecipientContext
): Promise<string[]> {
  if (draft.recipientsType === 'list' && draft.recipientsListId?.trim()) {
    const fromList = await resolveRecipientListEmails(conn, draft.recipientsListId)
    return [
      ...new Set(
        fromList.map((e) => normalizeMarketingEmail(e)).filter((e): e is string => !!e)
      )
    ]
  }
  const idStrings = [
    ...new Set(
      (draft.recipientsManual ?? [])
        .map((id) => String(id ?? '').trim())
        .filter((id) => mongoose.isValidObjectId(id))
    )
  ]
  if (!idStrings.length) return []
  const { Contact } = getTenantClientModels(conn)
  const objectIds = idStrings.map((id) => new mongoose.Types.ObjectId(id))
  const contacts = await (Contact as ContactModel)
    .find({ _id: { $in: objectIds }, deletedAt: null })
    .select('email')
    .lean<ContactLean[]>()
  const emailById = new Map(
    contacts.map((c) => [String(c._id), normalizeMarketingEmail(c.email)])
  )
  return idStrings
    .map((id) => emailById.get(id))
    .filter((e): e is string => !!e)
}

/**
 * Map normalized email → CRM contact for the given audience; list campaigns also hydrate from list membership IDs.
 */
export async function contactsByEmailForAudience(
  models: TenantClientModels,
  audience: CampaignAudienceConfig,
  emails: string[]
): Promise<Map<string, ContactLean>> {
  const { Contact, RecipientListMember } = models
  const contactByEmail = await loadContactsByNormalizedEmail(Contact as ContactModel, emails)

  if (audience.recipientsType === 'list' && audience.recipientsListId?.trim()) {
    const listIdRaw = audience.recipientsListId.trim()
    if (mongoose.isValidObjectId(listIdRaw)) {
      const listId = new mongoose.Types.ObjectId(listIdRaw)
      type MemberLean = { contactId?: mongoose.Types.ObjectId }
      const members = await (RecipientListMember as RecipientListMemberModel)
        .find({ recipientListId: listId })
        .select('contactId')
        .lean<MemberLean[]>()
      const ids = members.map((m) => m.contactId).filter(Boolean) as mongoose.Types.ObjectId[]
      const uniqueIds = [...new Set(ids.map((id) => String(id)))].map(
        (s) => new mongoose.Types.ObjectId(s)
      )
      if (uniqueIds.length) {
        const listContacts = await (Contact as ContactModel)
          .find({ _id: { $in: uniqueIds }, deletedAt: null })
          .lean<ContactLean[]>()
        mergeListMemberContactsIntoMap(contactByEmail, listContacts)
      }
    }
  }

  return contactByEmail
}

/** First email in send order that has a matching CRM row — used as the preview “sample” recipient. */
export function firstContactMatchingRecipientEmails(
  recipientEmails: string[],
  contactByEmail: Map<string, ContactLean>
): ContactLean | null {
  for (const raw of recipientEmails) {
    const key = normalizeMarketingEmail(raw)
    if (!key) continue
    const c = contactByEmail.get(key)
    if (c) return c
  }
  return null
}

/** CRM contact used for merge preview on a saved campaign detail / editor. */
export async function previewContactForSavedCampaign(
  conn: Connection,
  campaignId: string
): Promise<ContactLean | null> {
  if (!mongoose.isValidObjectId(campaignId)) return null
  const models = getTenantClientModels(conn)
  const { Campaign } = models
  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) return null
  const emails = await recipientEmailsForCampaign(conn, campaign)
  if (!emails.length) return null
  const map = await contactsByEmailForAudience(models, campaign, emails)
  return firstContactMatchingRecipientEmails(emails, map)
}

/** CRM contact used for merge preview before the campaign document exists. */
export async function previewContactForDraft(
  conn: Connection,
  draft: DraftRecipientContext
): Promise<ContactLean | null> {
  const emails = await recipientEmailsForDraft(conn, draft)
  if (!emails.length) return null
  const models = getTenantClientModels(conn)
  const audience: CampaignAudienceConfig = {
    recipientsType: draft.recipientsType,
    recipientsListId: draft.recipientsListId
  }
  const map = await contactsByEmailForAudience(models, audience, emails)
  return firstContactMatchingRecipientEmails(emails, map)
}
