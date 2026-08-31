/**
 * Parse zcMail outbound webhook payload (`type: email.status`) into a
 * Brevo-shaped body so Marketing Tracking can reuse the existing upsert path.
 */

import { normalizeBrevoWebhookEventName } from './parseBrevoTransactionalWebhookPayload'
import { zcMailObjectTagsToBrevoTagList } from '@server/utils/zcmail/campaignZcMailTags'

export type ParsedZcMailEmailStatusWebhook = {
  messageId: string
  event: string
  email: string
  subject: string
  from: string
  date: string
  tags: string[]
  reason: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (Array.isArray(v)) {
      const first = v.find((entry) => typeof entry === 'string' && entry.trim())
      if (typeof first === 'string') return first.trim()
    }
  }
  return ''
}

function collectTags(obj: Record<string, unknown>): string[] {
  const out: string[] = []
  const tags = obj.tags
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) out.push(t.trim())
    }
  } else if (isRecord(tags)) {
    const asRecord: Record<string, string> = {}
    for (const [k, v] of Object.entries(tags)) {
      if (typeof v === 'string' && v.trim()) asRecord[k] = v.trim()
    }
    out.push(...zcMailObjectTagsToBrevoTagList(asRecord))
    for (const [k, v] of Object.entries(asRecord)) {
      if (!['db', 'tenant', 'campaign', 'user', 'source'].includes(k)) {
        out.push(`${k}:${v}`)
      }
    }
  }
  return [...new Set(out)]
}

function resolveEventDate(obj: Record<string, unknown>): string {
  const ts = obj.eventTimestamp ?? obj.ts_event ?? obj.tsEvent ?? obj.ts
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
    const ms = ts > 1e12 ? ts : ts * 1000
    return new Date(ms).toISOString()
  }
  if (typeof ts === 'string' && ts.trim()) {
    const parsed = Date.parse(ts)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  const dateStr = pickString(obj, ['date', 'createdAt', 'eventTimestamp'])
  if (dateStr) {
    const parsed = Date.parse(dateStr)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  return new Date().toISOString()
}

export function parseZcMailEmailStatusWebhookPayload(
  body: unknown
): ParsedZcMailEmailStatusWebhook | null {
  if (!isRecord(body)) return null
  const nested = body.data
  const sources: Record<string, unknown>[] = [body]
  if (isRecord(nested)) sources.push(nested)

  const type = pickString(body, ['type'])
  if (type && type !== 'email.status') return null

  let messageId = ''
  let eventRaw = ''
  let email = ''
  let subject = ''
  let from = ''
  let reason = ''
  const tags: string[] = []
  let date = ''

  for (const src of sources) {
    if (!messageId) {
      messageId =
        pickString(src, ['sesMessageId', 'ses-message-id']) ||
        pickString(src, ['messageId', 'message-id', 'message_id'])
    }
    if (!eventRaw) eventRaw = pickString(src, ['event', 'eventType', 'Event'])
    if (!email) email = pickString(src, ['email', 'recipient', 'to'])
    if (!subject) subject = pickString(src, ['subject'])
    if (!from) from = pickString(src, ['from', 'sender'])
    if (!reason) reason = pickString(src, ['reason', 'error', 'smtpResponse'])
    tags.push(...collectTags(src))
    if (!date) date = resolveEventDate(src)
  }

  if (!messageId) return null
  const event = normalizeBrevoWebhookEventName(eventRaw) || eventRaw || 'unknown'

  return {
    messageId,
    event,
    email,
    subject,
    from,
    date,
    tags: [...new Set(tags)],
    reason
  }
}

/** Shape expected by `applyBrevoTrackingWebhook` / `parseBrevoTransactionalWebhookPayload`. */
export function zcMailWebhookToBrevoBody(
  parsed: ParsedZcMailEmailStatusWebhook
): Record<string, unknown> {
  return {
    event: parsed.event,
    'message-id': parsed.messageId,
    email: parsed.email,
    subject: parsed.subject,
    from: parsed.from,
    date: parsed.date,
    reason: parsed.reason,
    tags: parsed.tags
  }
}
