function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v)) {
      const first = v.find((entry) => typeof entry === 'string' && entry.trim())
      if (typeof first === 'string') return first.trim()
    }
  }
  return undefined
}

function pickDate(obj: Record<string, unknown>, keys: string[]): Date | undefined {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v > 1e12 ? v : v * 1000)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return undefined
}

export type ParsedBrevoTransactionalWebhook = {
  messageId: string
  event: string
  email?: string
  occurredAt: Date
  reason?: string
  link?: string
  tag?: string
}

/**
 * Brevo transactional webhook payloads vary by event type; extract stable fields.
 */
export function parseBrevoTransactionalWebhookPayload(
  body: unknown
): ParsedBrevoTransactionalWebhook | null {
  if (!isRecord(body)) return null

  let source: Record<string, unknown> = body
  const nested = body.item ?? body.data
  if (isRecord(nested)) source = nested

  const messageId =
    pickString(source, [
      'message-id',
      'messageId',
      'message_id',
      'messageid',
      'Message-ID',
      'MessageId',
      'smtp-id',
      'id'
    ]) ||
    pickString(body, [
      'message-id',
      'messageId',
      'message_id',
      'messageid',
      'Message-ID',
      'MessageId',
      'smtp-id',
      'id'
    ])

  if (!messageId) return null

  const event =
    pickString(source, ['event', 'Event', 'type', 'eventType']) ||
    pickString(body, ['event', 'Event', 'type', 'eventType']) ||
    'unknown'

  const email =
    pickString(source, ['email', 'recipient', 'to']) ||
    pickString(body, ['email', 'recipient', 'to'])

  const occurredAt =
    pickDate(source, ['date', 'ts', 'timestamp', 'time']) ||
    pickDate(body, ['date', 'ts', 'timestamp', 'time']) ||
    new Date()

  const reason =
    pickString(source, ['reason', 'error', 'description']) ||
    pickString(body, ['reason', 'error', 'description'])

  const link = pickString(source, ['link', 'url']) || pickString(body, ['link', 'url'])

  const tag = pickString(source, ['tag', 'tags']) || pickString(body, ['tag', 'tags'])

  return {
    messageId,
    event: event.toLowerCase(),
    ...(email ? { email: email.toLowerCase() } : {}),
    occurredAt,
    ...(reason ? { reason } : {}),
    ...(link ? { link } : {}),
    ...(tag ? { tag } : {})
  }
}
