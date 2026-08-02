/**
 * Brevo `getEmailEventReport` `event` query enum.
 * @see https://developers.brevo.com/reference/get-email-event-report
 */
export const BREVO_EMAIL_EVENT_TYPES = [
  'bounces',
  'hardBounces',
  'softBounces',
  'delivered',
  'spam',
  'requests',
  'opened',
  'clicks',
  'invalid',
  'deferred',
  'blocked',
  'unsubscribed',
  'error',
  'loadedByProxy'
] as const

export type BrevoEmailEventType = (typeof BREVO_EMAIL_EVENT_TYPES)[number]

const BREVO_EVENT_SET = new Set<string>(BREVO_EMAIL_EVENT_TYPES)

/** Map UI / Brevo payload labels onto the API `event` filter. */
const UI_TO_BREVO_EVENT: Record<string, BrevoEmailEventType> = {
  requests: 'requests',
  sent: 'requests',
  delivered: 'delivered',
  opened: 'opened',
  unique_opened: 'opened',
  clicks: 'clicks',
  click: 'clicks',
  error: 'error',
  spam: 'spam',
  invalid: 'invalid',
  deferred: 'deferred',
  blocked: 'blocked',
  unsubscribed: 'unsubscribed',
  loadedbyproxy: 'loadedByProxy',
  loaded_by_proxy: 'loadedByProxy',
  bounces: 'bounces',
  bounce: 'bounces',
  hardbounces: 'hardBounces',
  hard_bounces: 'hardBounces',
  softbounces: 'softBounces',
  soft_bounces: 'softBounces'
}

export function toBrevoEmailEventType(raw: string): BrevoEmailEventType | null {
  const t = raw.trim()
  if (!t) return null
  if (BREVO_EVENT_SET.has(t)) return t as BrevoEmailEventType
  const mapped = UI_TO_BREVO_EVENT[t.toLowerCase()]
  return mapped ?? null
}

/**
 * Normalize a client `event` / `events` query into distinct Brevo API event filters.
 * Empty → no Brevo event filter (fetch all types).
 */
export function normalizeBrevoEventTypesQuery(raw: unknown): BrevoEmailEventType[] {
  const parts: string[] = []
  if (typeof raw === 'string') {
    parts.push(...raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean))
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') parts.push(...item.split(/[,|]/).map((s) => s.trim()).filter(Boolean))
    }
  }
  const out: BrevoEmailEventType[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const ev = toBrevoEmailEventType(p)
    if (!ev || seen.has(ev)) continue
    seen.add(ev)
    out.push(ev)
  }
  return out
}
