import type { CampaignLean, CampaignMergeUserSnapshot } from '@server/types/tenant/campaign.model'
import { formatContactFullName } from '@server/utils/contactPersonName'
import { mergeUserSnapshotsForEmail } from '@server/utils/emailMerge/tenantUserFromAuth'
import {
  isTenantApiKeyAuthContext,
  tenantUserEmailFromAuth
} from '@server/tenant/registry-auth'
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
 * Build Reply-To from the current auth session (campaign creator / duplicator).
 * Email from tenant user; name from first/last, display name, or email.
 */
export function campaignReplyToFromAuth(auth: unknown): { email: string; name: string } | undefined {
  const email = tenantUserEmailFromAuth(auth)
  if (!email.includes('@')) return undefined

  if (isTenantApiKeyAuthContext(auth)) {
    const name = replyToNameFromUserSnapshot({
      firstName: auth.tenantUserFirstName,
      lastName: auth.tenantUserLastName,
      email: auth.tenantUserEmail
    })
    if (name) return { email, name }
    const display = auth.tenantUserName?.trim()
    if (display) return { email, name: display.slice(0, BREVO_REPLY_TO_NAME_MAX) }
  }

  return { email, name: email }
}

/**
 * Reply-To for Brevo send. Prefers persisted `campaign.replyTo`; falls back to legacy
 * `metadata.ownerEmail` + `mergeUserSnapshot` for campaigns created before the field existed.
 */
export function buildCampaignReplyTo(params: {
  campaign: Pick<CampaignLean, 'replyTo' | 'metadata' | 'mergeUserSnapshot'>
  /** Current tenant session — fallback for display name when snapshot is incomplete. */
  sessionUser?: UserMergeSnapshot | null
}): { email: string; name: string } | undefined {
  const stored = params.campaign.replyTo
  if (stored?.email?.includes('@') && stored.name?.trim()) {
    return {
      email: stored.email.trim().toLowerCase(),
      name: stored.name.trim().slice(0, BREVO_REPLY_TO_NAME_MAX)
    }
  }

  const email = replyToEmailFromCampaign(params.campaign)
  if (!email) return undefined
  const name =
    replyToNameFromUserSnapshot(params.campaign.mergeUserSnapshot, params.sessionUser) || email
  return { email, name }
}
