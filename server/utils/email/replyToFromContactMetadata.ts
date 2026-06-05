import type { CampaignLean, CampaignMergeUserSnapshot, CampaignReplyTo } from '@server/types/tenant/campaign.model'
import type { ContactLean } from '@server/types/tenant/contact.model'
import { formatContactFullName } from '@server/utils/contactPersonName'
import {
  mergeUserSnapshotsForEmail,
  userMergeSnapshotFromContactOwner
} from '@server/utils/emailMerge/tenantUserFromAuth'
import {
  isTenantApiKeyAuthContext,
  tenantUserEmailFromAuth
} from '@server/tenant/registry-auth'
import type { UserMergeSnapshot } from '~~/shared/utils/emailTemplateMerge'

const BREVO_REPLY_TO_NAME_MAX = 70

function normalizeReplyTo(replyTo: CampaignReplyTo): CampaignReplyTo {
  return {
    email: replyTo.email.trim().toLowerCase(),
    name: replyTo.name.trim().slice(0, BREVO_REPLY_TO_NAME_MAX)
  }
}

/** Display name for Brevo `replyTo.name` from first/last or email. */
export function replyToNameFromUserSnapshot(
  ...sources: Array<UserMergeSnapshot | CampaignMergeUserSnapshot | null | undefined>
): string {
  const merged = mergeUserSnapshotsForEmail(...sources)
  if (!merged) return ''
  const full = formatContactFullName(merged.firstName ?? '', merged.lastName ?? '')
  if (full) return full.slice(0, BREVO_REPLY_TO_NAME_MAX)
  const email = merged.email?.trim()
  if (email) return email.slice(0, BREVO_REPLY_TO_NAME_MAX)
  return ''
}

/**
 * Reply-To for the campaign creator (frozen at create in `campaign.replyTo`,
 * with `mergeUserSnapshot` as legacy fallback).
 */
export function buildCampaignCreatorReplyTo(
  campaign: Pick<CampaignLean, 'replyTo' | 'mergeUserSnapshot'>
): CampaignReplyTo | undefined {
  const stored = campaign.replyTo
  if (stored?.email?.includes('@')) {
    const name =
      stored.name?.trim() ||
      replyToNameFromUserSnapshot(campaign.mergeUserSnapshot) ||
      stored.email.trim()
    return normalizeReplyTo({ email: stored.email, name })
  }

  const snap = campaign.mergeUserSnapshot
  const email = snap?.email?.trim().toLowerCase()
  if (!email?.includes('@')) return undefined
  const name = replyToNameFromUserSnapshot(snap) || email
  return normalizeReplyTo({ email, name })
}

/**
 * Per-recipient Reply-To: contact CRM account owner (`metadata.owner*`),
 * then campaign creator.
 */
export function buildReplyToFromContactOwner(
  contact: ContactLean | null | undefined,
  creatorFallback: CampaignReplyTo | undefined
): CampaignReplyTo | undefined {
  const owner = userMergeSnapshotFromContactOwner(contact)
  const ownerEmail = owner?.email?.trim().toLowerCase()
  if (ownerEmail?.includes('@')) {
    const name = replyToNameFromUserSnapshot(owner) || ownerEmail
    return normalizeReplyTo({ email: ownerEmail, name })
  }
  return creatorFallback
}

/**
 * Build Reply-To from the current auth session (campaign creator / duplicator at create time).
 */
export function campaignReplyToFromAuth(auth: unknown): CampaignReplyTo | undefined {
  const email = tenantUserEmailFromAuth(auth)
  if (!email.includes('@')) return undefined

  if (isTenantApiKeyAuthContext(auth)) {
    const name = replyToNameFromUserSnapshot({
      firstName: auth.tenantUserFirstName,
      lastName: auth.tenantUserLastName,
      email: auth.tenantUserEmail
    })
    if (name) return normalizeReplyTo({ email, name })
    const display = auth.tenantUserName?.trim()
    if (display) return normalizeReplyTo({ email, name: display })
  }

  return normalizeReplyTo({ email, name: email })
}

/** @deprecated Use `buildCampaignCreatorReplyTo` or `buildReplyToFromContactOwner`. */
export function buildCampaignReplyTo(params: {
  campaign: Pick<CampaignLean, 'replyTo' | 'metadata' | 'mergeUserSnapshot'>
  sessionUser?: UserMergeSnapshot | null
}): CampaignReplyTo | undefined {
  return buildCampaignCreatorReplyTo(params.campaign)
}
