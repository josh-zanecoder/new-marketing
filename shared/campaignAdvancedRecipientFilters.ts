/**
 * Advanced Recipient Filtering helpers shared by server and app.
 * A filter-built campaign stores a dynamic recipient list and is marked `liveListAudience`,
 * so send resolves current list membership instead of a ManualRecipient snapshot.
 */

export const CAMPAIGN_ADVANCED_FILTER_LIST_PREFIX = 'Campaign audience · '

/**
 * Saved Advanced Recipient Filtering values for a filter-built campaign, as returned by
 * GET /campaigns/:id so the edit page can reopen the same audience.
 */
export type AdvancedRecipientFiltersInitial = {
  audience: string
  filterMode: 'and' | 'or'
  criterionJoins: ('and' | 'or')[]
  filterRows: { recipientFilterId: string; listPropertyValue: string }[]
  filterGroups: {
    rows: { recipientFilterId: string; listPropertyValue: string }[]
    joins: ('and' | 'or')[]
  }[]
  groupJoins: ('and' | 'or')[]
  /** Loan officers the sender explicitly picked (empty when the list just used their default scope). */
  loanOfficerEmails: string[]
  audienceStatuses: string[]
}

/**
 * Campaign statuses where a live-audience list is still needed to send (or resume sending).
 * Sent / Stopped / Failed campaigns no longer depend on it.
 */
export const LIVE_AUDIENCE_PROTECTED_STATUSES = ['Draft', 'Scheduled', 'Sending', 'Paused'] as const
const MAX_LIST_NAME_LENGTH = 200

/** True when send should resolve the live recipient list (Advanced Recipient Filtering). */
export function isCampaignLiveListAudience(campaign: {
  recipientsType?: string | null
  recipientsListId?: string | null
  liveListAudience?: boolean | null
}): boolean {
  return (
    campaign.liveListAudience === true &&
    campaign.recipientsType === 'list' &&
    String(campaign.recipientsListId ?? '').trim() !== ''
  )
}

/**
 * Name for the dynamic list created from a campaign's filters.
 * Uses the filter body name when provided, otherwise labels it with the campaign name.
 */
export function advancedFilterListName(campaignName: string, filterBodyName?: unknown): string {
  const given = typeof filterBodyName === 'string' ? filterBodyName.trim() : ''
  if (given) return given.slice(0, MAX_LIST_NAME_LENGTH)
  return `${CAMPAIGN_ADVANCED_FILTER_LIST_PREFIX}${campaignName.trim()}`.slice(0, MAX_LIST_NAME_LENGTH)
}

/** Maps the campaign form's recipient mode onto the persisted `recipientsType`. */
export function campaignRecipientsTypeForApi(
  mode: 'list' | 'manual' | 'filters'
): 'manual' | 'list' {
  return mode === 'manual' ? 'manual' : 'list'
}
