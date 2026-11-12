/**
 * Whether a campaign may be cancelled / unscheduled from the list or detail UI.
 * Scheduled sends are the primary case; leftover scheduledAt on Draft is cleaned up too.
 */
export function canUnscheduleCampaign(input: {
  status?: string | null
  scheduledAt?: string | Date | null
}): boolean {
  const status = String(input.status ?? '').trim()
  const hasScheduledAt = !!input.scheduledAt && String(input.scheduledAt).trim() !== ''
  if (status === 'Scheduled') return true
  // Leftover queue/time after a partial cancel — still clearable.
  if (status === 'Draft' && hasScheduledAt) return true
  return false
}

export type UnscheduleDecision =
  | { action: 'cancel' }
  | { action: 'already_cancelled' }
  | { action: 'reject'; message: string }

/**
 * Server-side decision for DELETE schedule/:id (idempotent for already-draft).
 */
export function decideCampaignUnschedule(input: {
  status?: string | null
  scheduledAt?: string | Date | null
}): UnscheduleDecision {
  const status = String(input.status ?? '').trim()
  const hasScheduledAt = !!input.scheduledAt && String(input.scheduledAt).trim() !== ''

  if (status === 'Scheduled' || (status === 'Draft' && hasScheduledAt)) {
    return { action: 'cancel' }
  }
  if (status === 'Draft') {
    return { action: 'already_cancelled' }
  }
  return {
    action: 'reject',
    message: `Only scheduled campaigns can be unscheduled (current status: ${status || 'unknown'})`
  }
}
