import type { Model } from 'mongoose'
import type { RegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { tenantUserEmailFromAuth } from '@server/tenant/registry-auth'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import { marketingAudienceOwnerEmailsFromAuth } from '@server/utils/auth/marketingAudienceFromAuth'

export type CampaignSenderCandidate = {
  email: string
  firstName: string
  lastName: string
  displayName: string
  avatarUrl: string
}

type ContactAggModel = Model<{ metadata?: Record<string, unknown> }>

function displayNameFromParts(firstName: string, lastName: string, email: string): string {
  const name = `${firstName} ${lastName}`.trim()
  return name || email
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Distinct CRM account-owner emails (plus session user) for LO sender pickers.
 * LO/LOA → self only. OM/Marketing → all owners.
 */
export async function listCampaignSenderCandidates(
  Contact: ContactAggModel,
  auth: RegisteredTenantAuthContext,
  options?: { q?: string; limit?: number }
): Promise<CampaignSenderCandidate[]> {
  const q = String(options?.q ?? '')
    .trim()
    .toLowerCase()
  const limitRaw = options?.limit
  const limit =
    typeof limitRaw === 'number' && Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), 30)
      : 12

  const scopeEmails = marketingAudienceOwnerEmailsFromAuth(auth)
  if (scopeEmails && !scopeEmails.length) return []

  const matchStage: Record<string, unknown> = {
    deletedAt: null,
    'metadata.ownerEmail': { $type: 'string', $ne: '' }
  }
  if (scopeEmails) {
    matchStage.$expr = {
      $in: [
        {
          $toLower: {
            $trim: {
              input: { $toString: { $ifNull: ['$metadata.ownerEmail', ''] } }
            }
          }
        },
        scopeEmails
      ]
    }
  }
  if (q) {
    const re = escapeRegex(q)
    matchStage.$or = [
      { 'metadata.ownerEmail': { $regex: re, $options: 'i' } },
      { 'metadata.ownerFirstName': { $regex: re, $options: 'i' } },
      { 'metadata.ownerLastName': { $regex: re, $options: 'i' } }
    ]
  }

  type AggRow = {
    _id: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
  }

  const rows = await Contact.aggregate<AggRow>([
    { $match: matchStage },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$metadata.ownerEmail' } } },
        firstName: { $first: '$metadata.ownerFirstName' },
        lastName: { $first: '$metadata.ownerLastName' },
        avatarUrl: { $first: '$metadata.ownerAvatarUrl' }
      }
    },
    { $match: { _id: { $type: 'string', $ne: '' } } },
    { $sort: { _id: 1 } },
    { $limit: limit }
  ])

  const byEmail = new Map<string, CampaignSenderCandidate>()
  for (const row of rows) {
    const email = String(row._id || '').trim().toLowerCase()
    if (!email) continue
    const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : ''
    const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : ''
    const avatarUrl = typeof row.avatarUrl === 'string' ? row.avatarUrl.trim() : ''
    byEmail.set(email, {
      email,
      firstName,
      lastName,
      displayName: displayNameFromParts(firstName, lastName, email),
      avatarUrl
    })
  }

  const session = tenantUserFieldsFromAuth(auth)
  const selfEmail = (session?.email || tenantUserEmailFromAuth(auth) || '').trim().toLowerCase()
  const selfAllowed =
    Boolean(selfEmail) && (scopeEmails === null || scopeEmails.includes(selfEmail))
  if (
    selfAllowed &&
    (!q ||
      selfEmail.includes(q) ||
      `${session?.firstName || ''} ${session?.lastName || ''}`.toLowerCase().includes(q))
  ) {
    const firstName = session?.firstName?.trim() || ''
    const lastName = session?.lastName?.trim() || ''
    if (!byEmail.has(selfEmail)) {
      byEmail.set(selfEmail, {
        email: selfEmail,
        firstName,
        lastName,
        displayName: displayNameFromParts(firstName, lastName, selfEmail),
        avatarUrl: ''
      })
    }
  }

  return [...byEmail.values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email))
    .slice(0, limit)
}

/**
 * True when `email` is an allowed LO From for this session.
 */
export async function isAllowedSelectedCampaignSenderEmail(
  Contact: ContactAggModel,
  auth: RegisteredTenantAuthContext,
  email: string
): Promise<boolean> {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  if (!normalized) return false

  const session = tenantUserFieldsFromAuth(auth)
  const selfEmail = (session?.email || tenantUserEmailFromAuth(auth) || '').trim().toLowerCase()
  if (selfEmail && selfEmail === normalized) return true

  const scopeEmails = marketingAudienceOwnerEmailsFromAuth(auth)
  if (scopeEmails) {
    return scopeEmails.includes(normalized)
  }

  const hit = await Contact.exists({
    deletedAt: null,
    'metadata.ownerEmail': {
      $regex: `^${escapeRegex(normalized)}$`,
      $options: 'i'
    }
  })
  return Boolean(hit)
}
