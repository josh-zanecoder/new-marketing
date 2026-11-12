/** Minimum lead time before a scheduled send may start (matches schedule API). */
export const CAMPAIGN_SCHEDULE_MIN_LEAD_MS = 60_000

export const CAMPAIGN_SCHEDULE_ERROR_INVALID = 'Pick a valid date and time.'
export const CAMPAIGN_SCHEDULE_ERROR_TOO_SOON =
  'Schedule time must be at least one minute from now'
export const CAMPAIGN_SCHEDULE_ERROR_REQUIRED = 'scheduledAt is required'
export const CAMPAIGN_SCHEDULE_ERROR_INVALID_DATE = 'scheduledAt must be a valid date'
export const CAMPAIGN_SCHEDULE_ERROR_STATUS =
  'Only draft or scheduled campaigns can be scheduled'

/** Statuses that may be scheduled (Draft) or rescheduled (Scheduled). */
export const CAMPAIGN_SCHEDULEABLE_STATUSES = ['Draft', 'Scheduled'] as const

export type CampaignScheduleableStatus = (typeof CAMPAIGN_SCHEDULEABLE_STATUSES)[number]

export type CampaignScheduleWhenResult =
  | { ok: true; when: Date }
  | { ok: false; message: string }

export function isCampaignScheduleableStatus(
  status: string
): status is CampaignScheduleableStatus {
  return (CAMPAIGN_SCHEDULEABLE_STATUSES as readonly string[]).includes(status)
}

/**
 * Validate a schedule instant: must be a real date and at least
 * {@link CAMPAIGN_SCHEDULE_MIN_LEAD_MS} ahead of `nowMs`.
 */
export function validateCampaignScheduleWhen(
  when: Date,
  nowMs = Date.now()
): CampaignScheduleWhenResult {
  if (Number.isNaN(when.getTime())) {
    return { ok: false, message: CAMPAIGN_SCHEDULE_ERROR_INVALID }
  }
  if (when.getTime() < nowMs + CAMPAIGN_SCHEDULE_MIN_LEAD_MS) {
    return { ok: false, message: CAMPAIGN_SCHEDULE_ERROR_TOO_SOON }
  }
  return { ok: true, when }
}

/** Parse ISO / Date-parsable string then validate lead time. */
export function parseAndValidateCampaignScheduleAt(
  scheduledAtRaw: string,
  nowMs = Date.now()
): CampaignScheduleWhenResult {
  const trimmed = String(scheduledAtRaw ?? '').trim()
  if (!trimmed) {
    return { ok: false, message: CAMPAIGN_SCHEDULE_ERROR_REQUIRED }
  }
  const when = new Date(trimmed)
  if (Number.isNaN(when.getTime())) {
    return { ok: false, message: CAMPAIGN_SCHEDULE_ERROR_INVALID_DATE }
  }
  const lead = validateCampaignScheduleWhen(when, nowMs)
  if (!lead.ok) {
    return {
      ok: false,
      message:
        lead.message === CAMPAIGN_SCHEDULE_ERROR_INVALID
          ? CAMPAIGN_SCHEDULE_ERROR_INVALID_DATE
          : lead.message
    }
  }
  return lead
}
