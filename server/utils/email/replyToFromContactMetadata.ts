import type { CampaignLean, CampaignMergeUserSnapshot } from '@server/types/tenant/campaign.model'
import { formatContactFullName } from '@server/utils/contactPersonName'
import { mergeUserSnapshotsForEmail } from '@server/utils/emailMerge/tenantUserFromAuth'
import type { UserMergeSnapshot } from '~~/shared/utils/emailTemplateMerge'

const BREVO_REPLY_TO_NAME_MAX = 70

function replyToEmailFromCampaign(
  campaign: Pick<CampaignLean, 'metadata' | 'mergeUserSnapshot'>
): string | undefined {
  const meta = campaign.metadata
  const ownerRaw =
    meta && typeof meta.ownerEmail === 'string' ? meta.ownerEmail.trim().toLowerCase() : ''
  if (ownerRaw.includes('@')) return ownerRaw
  return undefined
}

/** Display name for Brevo `replyTo.name` — campaign snapshot first, then logged-in session user. */
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
 * Reply-To email from campaign `metadata.ownerEmail` (campaign owner, not recipient contact).
 * Name from `mergeUserSnapshot`, with logged-in user fields filling gaps when provided.
 */
export function buildCampaignReplyTo(params: {
  campaign: Pick<CampaignLean, 'metadata' | 'mergeUserSnapshot'>
  /** Current tenant session — fallback for display name when snapshot is incomplete. */
  sessionUser?: UserMergeSnapshot | null
}): { email: string; name: string } | undefined {
  const email = replyToEmailFromCampaign(params.campaign)
  if (!email) return undefined
  const name =
    replyToNameFromUserSnapshot(params.campaign.mergeUserSnapshot, params.sessionUser) || email
  return { email, name }
}
