import type { Connection } from 'mongoose'
import mongoose from 'mongoose'
import { normalizeMarketingEmail } from '../helpers/marketingEmail'
import { getTenantClientModels } from '../models/tenant/tenantClientModels'
import type { CampaignLean, CampaignModel } from '../types/tenant/campaign.model'
import type { ContactLean, ContactModel } from '../types/tenant/contact.model'
import type { ManualRecipientLean, ManualRecipientModel } from '../types/tenant/manualRecipient.model'
import { resolveRecipientListEmails } from './resolveRecipientListEmails'

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

/**
 * One contact to drive `recipient.*` merge in UI preview (editor + campaign detail).
 * List campaigns: first member of the list’s resolved contacts; manual: first manual email matched in Contact.
 */
export async function getSampleContactLeanForCampaignPreview(
  conn: Connection,
  campaignId: string
): Promise<ContactLean | null> {
  if (!mongoose.isValidObjectId(campaignId)) return null
  const { Campaign, Contact, ManualRecipient } = getTenantClientModels(conn)
  const campaign = await (Campaign as CampaignModel).findById(campaignId).lean<CampaignLean | null>()
  if (!campaign) return null

  const ContactModel = Contact as ContactModel

  if (campaign.recipientsType === 'list' && campaign.recipientsListId?.trim()) {
    const listEmails = await resolveRecipientListEmails(conn, campaign.recipientsListId)
    const firstEmail = listEmails
      .map((e) => normalizeMarketingEmail(e))
      .find((e): e is string => !!e && e.includes('@'))
    if (firstEmail) {
      const docs = await ContactModel.find({
        deletedAt: null,
        $expr: {
          $in: [
            { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
            [firstEmail]
          ]
        }
      })
        .lean<ContactLean[]>()
      if (docs.length) return docs.reduce((a, b) => pickPreferredContact(a, b))
    }
  }

  const manuals = await (ManualRecipient as ManualRecipientModel)
    .find({ campaign: campaignId })
    .limit(25)
    .lean<ManualRecipientLean[]>()

  const normalizedEmails = [
    ...new Set(
      manuals.map((m) => normalizeMarketingEmail(m.email)).filter((e): e is string => !!e && e.includes('@'))
    )
  ]
  if (!normalizedEmails.length) return null

  const docs = await ContactModel.find({
    deletedAt: null,
    $expr: {
      $in: [
        { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
        normalizedEmails
      ]
    }
  })
    .lean<ContactLean[]>()

  if (!docs.length) return null
  return docs.reduce((a, b) => pickPreferredContact(a, b))
}

export type DraftRecipientContext = {
  recipientsType: 'list' | 'manual'
  recipientsListId?: string
  recipientsManual?: string[]
}

/** Sample contact for merge preview when the campaign is not saved yet (add-campaign wizard). */
export async function getSampleContactLeanForDraftPreview(
  conn: Connection,
  draft: DraftRecipientContext
): Promise<ContactLean | null> {
  const { Contact } = getTenantClientModels(conn)
  const ContactModel = Contact as ContactModel

  if (draft.recipientsType === 'list' && draft.recipientsListId?.trim()) {
    const listEmails = await resolveRecipientListEmails(conn, draft.recipientsListId)
    const firstEmail = listEmails
      .map((e) => normalizeMarketingEmail(e))
      .find((e): e is string => !!e && e.includes('@'))
    if (firstEmail) {
      const docs = await ContactModel.find({
        deletedAt: null,
        $expr: {
          $in: [
            { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
            [firstEmail]
          ]
        }
      })
        .lean<ContactLean[]>()
      if (docs.length) return docs.reduce((a, b) => pickPreferredContact(a, b))
    }
    return null
  }

  const normalizedEmails = [
    ...new Set(
      (draft.recipientsManual ?? [])
        .map((e) => normalizeMarketingEmail(String(e)))
        .filter((e): e is string => !!e && e.includes('@'))
    )
  ]
  if (!normalizedEmails.length) return null

  const docs = await ContactModel.find({
    deletedAt: null,
    $expr: {
      $in: [
        { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
        normalizedEmails
      ]
    }
  })
    .lean<ContactLean[]>()

  if (!docs.length) return null
  return docs.reduce((a, b) => pickPreferredContact(a, b))
}
