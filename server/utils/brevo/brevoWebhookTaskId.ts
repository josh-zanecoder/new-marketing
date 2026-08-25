import { BREVO_WEBHOOK_CLOUD_TASK_ID_PREFIX } from '@server/constants/brevoWebhookTask'
import type { ParsedBrevoTransactionalWebhook } from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'

function sanitizeSegment(value: string, maxLen: number): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen)
}

/** Stable Cloud Task id for one Brevo event (dedupes Brevo retries). */
export function brevoWebhookCloudTaskId(parsed: ParsedBrevoTransactionalWebhook): string {
  const messageId = sanitizeSegment(parsed.messageId || 'unknown', 120)
  const event = sanitizeSegment(parsed.event || 'event', 40)
  const date = sanitizeSegment(parsed.date || 'date', 40)
  return `${BREVO_WEBHOOK_CLOUD_TASK_ID_PREFIX}${messageId}-${event}-${date}`.slice(0, 500)
}
