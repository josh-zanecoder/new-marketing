export type SendableCampaignAudience = {
  status?: string | null
  recipientsType?: string | null
  recipientsListId?: string | null
  recipients?: unknown[] | null
  recipientsCount?: number | null
}

/**
 * A copied campaign list row used to report 0 recipients for list audiences
 * even when the selected people were present. Either the count or the rows is enough.
 */
export function hasSendableCampaignRecipients(c: SendableCampaignAudience): boolean {
  if (c.recipientsType !== 'manual' && c.recipientsType !== 'list') return false
  const fromRows = c.recipients?.length ?? 0
  const fromCount = typeof c.recipientsCount === 'number' ? c.recipientsCount : 0
  if (Math.max(fromRows, fromCount) > 0) return true
  return (
    c.recipientsType === 'list' &&
    c.recipientsCount == null &&
    c.recipients == null &&
    !!c.recipientsListId?.trim()
  )
}

/** Same gate the campaign wizard uses on the final Schedule click. */
export function canScheduleCampaignDraft(c: SendableCampaignAudience): boolean {
  return c.status === 'Draft' && hasSendableCampaignRecipients(c)
}
