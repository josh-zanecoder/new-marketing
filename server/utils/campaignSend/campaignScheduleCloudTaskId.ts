import { randomUUID } from 'node:crypto'

/**
 * Cloud Tasks remembers deleted task names for hours (dedup / tombstone window).
 * Deterministic ids like `cs-schedule-{db}-{campaignId}` therefore break
 * cancel → schedule-again. Always mint a unique suffix for new schedule tasks.
 *
 * @see https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks/create
 */

function sanitizeTaskIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** Pre-fix deterministic id (still deleted on cancel for leftover jobs). */
export function legacyCampaignScheduleCloudTaskId(dbName: string, campaignId: string): string {
  return sanitizeTaskIdSegment(`cs-schedule-${dbName}-${campaignId}`).slice(0, 500)
}

/** New schedule task id — unique per enqueue so tombstones cannot block reschedule. */
export function newCampaignScheduleCloudTaskId(
  dbName: string,
  campaignId: string,
  uniqueSuffix: string = randomUUID().replace(/-/g, '')
): string {
  const suffix = sanitizeTaskIdSegment(String(uniqueSuffix || '').trim()) || randomUUID().replace(/-/g, '')
  return sanitizeTaskIdSegment(`cs-schedule-${dbName}-${campaignId}-${suffix}`).slice(0, 500)
}

export function campaignScheduleCloudTaskMatchesCampaign(
  taskId: string,
  campaignId: string,
  dbName: string
): boolean {
  if (!taskId.startsWith('cs-schedule')) return false
  const dbSeg = sanitizeTaskIdSegment(dbName)
  return taskId.includes(campaignId) && taskId.includes(dbSeg)
}
