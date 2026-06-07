export type CampaignScheduleMode = 'new' | 'resume' | 'resend_all'

export function scheduleModalTitle(mode: CampaignScheduleMode): string {
  if (mode === 'resume') return 'Resume schedule'
  if (mode === 'resend_all') return 'Schedule again'
  return 'Schedule send'
}

export function scheduleModalDescription(mode: CampaignScheduleMode): string {
  if (mode === 'resume') {
    return 'Choose when to send to unsent recipients only. Already-sent contacts are skipped.'
  }
  if (mode === 'resend_all') {
    return 'Choose when to send to all recipients again. People who already received this campaign may get duplicate emails.'
  }
  return 'Choose when this campaign should start sending to the full audience (your local time).'
}
