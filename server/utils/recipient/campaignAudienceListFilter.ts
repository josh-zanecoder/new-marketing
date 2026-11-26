import { CAMPAIGN_ADVANCED_FILTER_LIST_PREFIX } from '~~/shared/campaignAdvancedRecipientFilters'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Lists that Advanced Recipient Filtering creates for a campaign are an implementation detail of that
 * campaign, not something to browse or pick on the Recipient lists page. They are flagged
 * `campaignAudience`; the name prefix covers any made before the flag existed.
 */
export const EXCLUDE_CAMPAIGN_AUDIENCE_LISTS: Record<string, unknown> = {
  campaignAudience: { $ne: true },
  name: { $not: new RegExp(`^${escapeRegex(CAMPAIGN_ADVANCED_FILTER_LIST_PREFIX)}`) }
}
