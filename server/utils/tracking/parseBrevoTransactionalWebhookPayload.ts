/**
 * Parse Brevo transactional webhook JSON into a normalized event for Marketing Tracking.
 * @see https://developers.brevo.com/docs/transactional-webhooks
 */

export type ParsedBrevoTransactionalWebhook = {
  messageId: string
  event: string
  email: string
  /** ISO-8601 UTC when possible. */
  date: string
  subject: string
  from: string
  ip: string
  link: string
  reason: string
  /** Raw tag string for storage (joined tags). */
  tag: string
  tags: string[]
  templateId: number | null
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

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function collectTags(obj: Record<string, unknown>): string[] {
  const out: string[] = []
  const tags = obj.tags
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) out.push(t.trim())
    }
  }
  const tag = obj.tag
  if (typeof tag === 'string' && tag.trim()) {
    // Sometimes a JSON array string: ["a","b"]
    const raw = tag.trim()
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (typeof t === 'string' && t.trim()) out.push(t.trim())
          }
        }
      } catch {
        out.push(raw)
      }
    } else {
      out.push(...raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean))
    }
  }
  return [...new Set(out)]
}

/**
 * Map Brevo webhook event names onto the transactional events-report vocabulary
 * used by Tracking sync (`requests`, `hardBounces`, `clicks`, …).
 */
export function normalizeBrevoWebhookEventName(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const key = t.toLowerCase().replace(/[-\s]+/g, '_')
  const map: Record<string, string> = {
    request: 'requests',
    requests: 'requests',
    sent: 'requests',
    send: 'requests',
    delivered: 'delivered',
    delivery: 'delivered',
    soft_bounce: 'softBounces',
    softbounce: 'softBounces',
    softbounces: 'softBounces',
    hard_bounce: 'hardBounces',
    hardbounce: 'hardBounces',
    hardbounces: 'hardBounces',
    /** zcMail UI / webhooks use `bounced` for SES Bounce. */
    bounced: 'hardBounces',
    bounce: 'bounces',
    bounces: 'bounces',
    opened: 'opened',
    open: 'opened',
    unique_opened: 'unique_opened',
    uniqueopened: 'unique_opened',
    first_opening: 'unique_opened',
    click: 'clicks',
    clicks: 'clicks',
    clicked: 'clicks',
    spam: 'spam',
    complaint: 'spam',
    blocked: 'blocked',
    reject: 'blocked',
    invalid: 'invalid',
    deferred: 'deferred',
    deliverydelay: 'deferred',
    delivery_delay: 'deferred',
    error: 'error',
    renderingfailure: 'error',
    rendering_failure: 'error',
    unsubscribed: 'unsubscribed',
    loaded_by_proxy: 'loadedByProxy',
    loadedbyproxy: 'loadedByProxy',
    proxy_open: 'loadedByProxy'
  }
  return map[key] || t
}

function resolveEventDate(obj: Record<string, unknown>): string {
  const tsEvent = pickNumber(obj, ['ts_event', 'tsEvent'])
  if (tsEvent != null && tsEvent > 0) {
    // Brevo docs: seconds GMT
    const ms = tsEvent > 1e12 ? tsEvent : tsEvent * 1000
    return new Date(ms).toISOString()
  }
  const ts = pickNumber(obj, ['ts'])
  if (ts != null && ts > 0) {
    const ms = ts > 1e12 ? ts : ts * 1000
    return new Date(ms).toISOString()
  }
  const tsEpoch = pickNumber(obj, ['ts_epoch', 'tsEpoch'])
  if (tsEpoch != null && tsEpoch > 0) {
    const ms = tsEpoch > 1e12 ? tsEpoch : tsEpoch * 1000
    return new Date(ms).toISOString()
  }
  const dateStr = pickString(obj, ['date', 'Date'])
  if (dateStr) {
    // "YYYY-MM-DD HH:mm:ss" (account TZ) — treat as UTC-ish fallback
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z'
    const parsed = Date.parse(normalized)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
    return dateStr
  }
  return new Date().toISOString()
}

export function parseBrevoTransactionalWebhookPayload(
  body: unknown
): ParsedBrevoTransactionalWebhook | null {
  if (!isRecord(body)) return null

  const nested = body.item ?? body.data
  const sources: Record<string, unknown>[] = [body]
  if (isRecord(nested)) sources.push(nested)

  let messageId = ''
  let eventRaw = ''
  let email = ''
  let subject = ''
  let from = ''
  let ip = ''
  let link = ''
  let reason = ''
  let templateId: number | null = null
  const tags: string[] = []
  let date = ''

  for (const src of sources) {
    if (!messageId) {
      messageId = pickString(src, [
        'message-id',
        'messageId',
        'message_id',
        'messageid',
        'Message-ID',
        'MessageId',
        'smtp-id'
      ])
    }
    if (!eventRaw) eventRaw = pickString(src, ['event', 'Event', 'type', 'eventType'])
    if (!email) email = pickString(src, ['email', 'Email', 'to'])
    if (!subject) subject = pickString(src, ['subject', 'Subject'])
    if (!from) from = pickString(src, ['from', 'From', 'sender'])
    if (!ip) ip = pickString(src, ['ip', 'IP', 'sending_ip', 'sendingIp'])
    if (!link) link = pickString(src, ['link', 'url'])
    if (!reason) reason = pickString(src, ['reason', 'Reason'])
    if (templateId == null) templateId = pickNumber(src, ['template_id', 'templateId'])
    tags.push(...collectTags(src))
    if (!date) date = resolveEventDate(src)
  }

  const event = normalizeBrevoWebhookEventName(eventRaw)
  if (!messageId || !event) return null

  // Ensure angle-bracket form when Brevo omits them (event report often includes <>).
  let mid = messageId
  if (!mid.startsWith('<') && mid.includes('@')) mid = `<${mid}>`

  const uniqueTags = [...new Set(tags)]

  return {
    messageId: mid,
    event,
    email,
    date,
    subject,
    from,
    ip,
    link,
    reason,
    tag: uniqueTags.join('|'),
    tags: uniqueTags,
    templateId
  }
}

export function resolveDbNameFromBrevoTags(tags: string[]): string | null {
  for (const t of tags) {
    const lower = t.toLowerCase()
    if (lower.startsWith('db:')) {
      const db = t.slice(3).trim()
      if (db) return db
    }
  }
  return null
}

export function resolveTenantIdFromBrevoTags(tags: string[]): string | null {
  for (const t of tags) {
    const lower = t.toLowerCase()
    if (lower.startsWith('tenant:')) {
      const id = t.slice('tenant:'.length).trim()
      if (id) return id
    }
  }
  return null
}
