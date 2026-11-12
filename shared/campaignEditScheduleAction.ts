export type CampaignEditScheduleAction = 'schedule' | 'reschedule'

/**
 * Edit wizard footer: Draft → Schedule send; Scheduled with a time → Reschedule.
 */
export function resolveCampaignEditScheduleAction(
  status: string | null | undefined,
  scheduledAt: string | null | undefined
): CampaignEditScheduleAction {
  const at = String(scheduledAt ?? '').trim()
  return status === 'Scheduled' && at ? 'reschedule' : 'schedule'
}
