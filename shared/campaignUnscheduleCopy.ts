export const CAMPAIGN_UNSCHEDULE_SUCCESS = 'Campaign schedule canceled successfully.'

export const CAMPAIGN_UNSCHEDULE_ERROR_FALLBACK =
  'Could not cancel the scheduled send. Try again.'

export const CAMPAIGN_UNSCHEDULE_CONFIRM_TITLE = 'Cancel scheduled send'

export function campaignUnscheduleConfirmMessage(name: string): string {
  const label = name.trim() || 'Untitled'
  return `Cancel the scheduled send for "${label}"? The campaign returns to draft and will not send at the scheduled time.`
}
