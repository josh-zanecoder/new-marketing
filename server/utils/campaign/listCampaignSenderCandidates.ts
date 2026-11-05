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

type ContactAggModel = Model<{
  metadata?: Record<string, unknown>
  email?: string
  firstName?: string
  lastName?: string
  name?: string
}>

export function displayNameFromParts(firstName: string, lastName: string, email: string): string {
  const name = `${firstName} ${lastName}`.trim()
  return name || email
}

/** Prefer rows that actually have owner first/last (avoids $first landing on empty metadata). */
export function pickBestOwnerNameFields(
  rows: Array<{ firstName?: unknown; lastName?: unknown; avatarUrl?: unknown }>
): { firstName: string; lastName: string; avatarUrl: string } {
  let best = { firstName: '', lastName: '', avatarUrl: '', score: -1 }
  for (const row of rows) {
    const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : ''
    const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : ''
    const avatarUrl = typeof row.avatarUrl === 'string' ? row.avatarUrl.trim() : ''
    const score = (firstName ? 1 : 0) + (lastName ? 1 : 0)
    if (score > best.score) {
      best = { firstName, lastName, avatarUrl: avatarUrl || best.avatarUrl, score }
    } else if (score === best.score && !best.avatarUrl && avatarUrl) {
      best.avatarUrl = avatarUrl
    }
  }
  return { firstName: best.firstName, lastName: best.lastName, avatarUrl: best.avatarUrl }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ownerEmailLowerExpr() {
  return {
    $toLower: {
      $trim: {
        input: { $toString: { $ifNull: ['$metadata.ownerEmail', ''] } }
      }
    }
  }
}

/**
 * Distinct CRM account-owner emails (plus session user) for LO sender pickers.
 * LO/LOA → self only. OM/Marketing → all owners.
 * Prefers non-empty ownerFirstName/ownerLastName so Sender UI is not email/email.
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

  const matchAnd: Record<string, unknown>[] = [
    { deletedAt: null },
    { 'metadata.ownerEmail': { $type: 'string', $ne: '' } }
  ]
  if (scopeEmails) {
    matchAnd.push({
      $expr: {
        $in: [ownerEmailLowerExpr(), scopeEmails]
      }
    })
  }
  if (q) {
    // Exact LO email lookup (Marketing/OM list→sender resolve) — avoid loose regex miss on +.
    if (q.includes('@')) {
      matchAnd.push({
        $expr: { $eq: [ownerEmailLowerExpr(), q] }
      })
    } else {
      const re = escapeRegex(q)
      matchAnd.push({
        $or: [
          { 'metadata.ownerEmail': { $regex: re, $options: 'i' } },
          { 'metadata.ownerFirstName': { $regex: re, $options: 'i' } },
          { 'metadata.ownerLastName': { $regex: re, $options: 'i' } }
        ]
      })
    }
  }

  type AggRow = {
    _id: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
  }

  const rows = await Contact.aggregate<AggRow>([
    { $match: { $and: matchAnd } },
    {
      $addFields: {
        _ownerNameScore: {
          $add: [
            {
              $cond: [
                {
                  $gt: [
                    {
                      $strLenCP: {
                        $trim: { input: { $ifNull: ['$metadata.ownerFirstName', ''] } }
                      }
                    },
                    0
                  ]
                },
                1,
                0
              ]
            },
            {
              $cond: [
                {
                  $gt: [
                    {
                      $strLenCP: {
                        $trim: { input: { $ifNull: ['$metadata.ownerLastName', ''] } }
                      }
                    },
                    0
                  ]
                },
                1,
                0
              ]
            }
          ]
        }
      }
    },
    // Non-empty owner names first so $group $first does not keep an empty sibling doc.
    { $sort: { _ownerNameScore: -1 } },
    {
      $group: {
        _id: ownerEmailLowerExpr(),
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
    const picked = pickBestOwnerNameFields([row])
    byEmail.set(email, {
      email,
      firstName: picked.firstName,
      lastName: picked.lastName,
      displayName: displayNameFromParts(picked.firstName, picked.lastName, email),
      avatarUrl: picked.avatarUrl
    })
  }

  await enrichCandidatesFromLoContactProfiles(Contact, byEmail)

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
    const existing = byEmail.get(selfEmail)
    if (!existing) {
      byEmail.set(selfEmail, {
        email: selfEmail,
        firstName,
        lastName,
        displayName: displayNameFromParts(firstName, lastName, selfEmail),
        avatarUrl: ''
      })
    } else if (!existing.firstName && !existing.lastName && (firstName || lastName)) {
      // Session profile often has the LO name when borrower metadata owner names are empty.
      byEmail.set(selfEmail, {
        ...existing,
        firstName,
        lastName,
        displayName: displayNameFromParts(firstName, lastName, selfEmail)
      })
    }
  }

  return [...byEmail.values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email))
    .slice(0, limit)
}

/**
 * When owner metadata names are empty, use the LO's own Contact row (email = owner email).
 * Marketing/OM pick any LO — that profile often has firstName/lastName even if borrower
 * ownerFirstName/ownerLastName were never synced.
 */
async function enrichCandidatesFromLoContactProfiles(
  Contact: ContactAggModel,
  byEmail: Map<string, CampaignSenderCandidate>
): Promise<void> {
  const needing = [...byEmail.values()].filter((c) => !c.firstName && !c.lastName)
  if (!needing.length) return

  const emails = needing.map((c) => c.email)
  const people = await Contact.find({
    deletedAt: null,
    $expr: {
      $in: [
        {
          $toLower: {
            $trim: { input: { $toString: { $ifNull: ['$email', ''] } } }
          }
        },
        emails
      ]
    }
  })
    .select({ email: 1, firstName: 1, lastName: 1, name: 1 })
    .lean()

  // Case-insensitive email keys (stored emails may differ in casing).
  const byPersonEmail = new Map<string, { firstName: string; lastName: string }>()
  for (const doc of people) {
    const email = String((doc as { email?: string }).email ?? '')
      .trim()
      .toLowerCase()
    if (!email || byPersonEmail.has(email)) continue
    const firstName = String((doc as { firstName?: string }).firstName ?? '').trim()
    const lastName = String((doc as { lastName?: string }).lastName ?? '').trim()
    const name = String((doc as { name?: string }).name ?? '').trim()
    if (!firstName && !lastName && name) {
      const parts = name.split(/\s+/).filter(Boolean)
      byPersonEmail.set(email, {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ')
      })
    } else if (firstName || lastName) {
      byPersonEmail.set(email, { firstName, lastName })
    }
  }

  for (const email of emails) {
    const person = byPersonEmail.get(email)
    const current = byEmail.get(email)
    if (!person || !current) continue
    if (!person.firstName && !person.lastName) continue
    byEmail.set(email, {
      ...current,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: displayNameFromParts(person.firstName, person.lastName, email)
    })
  }
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
