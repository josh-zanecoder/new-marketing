import type { H3Event } from 'h3'

export interface BrevoTrackingEmailEvent {
  email?: string
  date?: string
  messageId?: string
  event?: string
  tag?: string
}

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i

export function parseTagSegments(tagStr: string | undefined): string[] {
  if (!tagStr?.trim()) return []
  // Brevo UI often shows tags joined with `|`; the events API typically uses commas.
  return tagStr.split(/[,|]/).map((p) => p.trim()).filter(Boolean)
}

export function normalizeCampaignIdQuery(event: H3Event): string | null {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.campaignId
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  if (!s || !MONGO_OBJECT_ID_RE.test(s)) return null
  return s
}

export function normalizeYmdQuery(event: H3Event, key: 'from' | 'to'): string | null {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q[key]
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/**
 * Browser `Date#getTimezoneOffset()` (minutes to add to local to get UTC).
 * Example: UTC+8 → `-480`. Used so server-side day filters match the UI.
 */
export function normalizeTzOffsetQuery(event: H3Event): number | null {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.tzOffset
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : typeof raw === 'number'
          ? String(raw)
          : ''
  if (!s || !/^-?\d{1,4}$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < -840 || n > 840) return null
  return n
}

function eventTagMatchesTenant(
  tagStr: string | undefined,
  dbName: string,
  marketingTenantId: string | null
): boolean {
  const parts = parseTagSegments(tagStr)
  const dbToken = `db:${dbName}`
  if (parts.includes(dbToken)) return true
  if (marketingTenantId) {
    const tenantToken = `tenant:${marketingTenantId}`
    if (parts.includes(tenantToken)) return true
  }
  return false
}

export function eventMatchesAnyAdminTenant(
  tagStr: string | undefined,
  tenants: Array<{ dbName: string; marketingTenantId: string | null }>
): boolean {
  return tenants.some((tenant) =>
    eventTagMatchesTenant(tagStr, tenant.dbName, tenant.marketingTenantId)
  )
}

function eventTagMatchesCampaign(tagStr: string | undefined, campaignId: string): boolean {
  return parseTagSegments(tagStr).includes(`campaign:${campaignId}`)
}

/**
 * Match Brevo `user:` tags against allowed emails (case-insensitive).
 * Send prefers email for the user tag; name-only tags will not match email scope.
 */
export function eventTagMatchesUsers(
  tagStr: string | undefined,
  userEmails: string[]
): boolean {
  if (!userEmails.length) return false
  const allowed = new Set(
    userEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  )
  if (!allowed.size) return false

  for (const part of parseTagSegments(tagStr)) {
    if (!part.toLowerCase().startsWith('user:')) continue
    const value = part.slice('user:'.length).trim().toLowerCase()
    if (value && allowed.has(value)) return true
  }
  return false
}

/** Distinct `user:{email}` values from events (email-shaped only; sorted). */
export function extractUserEmailsFromBrevoEvents(
  events: readonly BrevoTrackingEmailEvent[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of events) {
    for (const part of parseTagSegments(item.tag)) {
      if (!part.toLowerCase().startsWith('user:')) continue
      const value = part.slice('user:'.length).trim().toLowerCase()
      if (!value.includes('@') || seen.has(value)) continue
      seen.add(value)
      out.push(value)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

export function normalizeUserEmailQuery(event: H3Event): string | null {
  const q = getQuery(event) as Record<string, unknown>
  const raw = q.userEmail
  const s =
    typeof raw === 'string'
      ? raw.trim().toLowerCase()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim().toLowerCase()
        : ''
  if (!s || !s.includes('@') || s.length > 320) return null
  return s
}

export function extractBrevoEventsFromReport(report: unknown): BrevoTrackingEmailEvent[] {
  if (report == null || typeof report !== 'object') return []
  const raw = (report as { events?: unknown }).events
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is BrevoTrackingEmailEvent => item != null && typeof item === 'object')
}

export interface FilterBrevoEventsForTenantOptions {
  dbName: string
  marketingTenantId?: string | null
  /** When set, keep only events tagged `campaign:{id}` (campaign detail tracking). */
  campaignId?: string | null
  /**
   * When non-null, restrict to events tagged `user:{email}` in this list.
   * `null` / omitted = tenant-wide (no user filter). `[]` = match nothing.
   */
  userEmails?: string[] | null
}

/**
 * Layered tracking filter:
 * 1. tenant (`db:` or `tenant:`) — always
 * 2. user (`user:`) — when the session is not tenant-wide
 * 3. campaign (`campaign:`) — when a campaign is opened
 */
export function filterBrevoEventsForTenant(
  events: BrevoTrackingEmailEvent[],
  dbNameOrOptions: string | FilterBrevoEventsForTenantOptions,
  marketingTenantId?: string | null,
  campaignId?: string | null,
  userEmails?: string[] | null
): BrevoTrackingEmailEvent[] {
  const opts: FilterBrevoEventsForTenantOptions =
    typeof dbNameOrOptions === 'string'
      ? {
          dbName: dbNameOrOptions,
          marketingTenantId: marketingTenantId ?? null,
          campaignId: campaignId ?? null,
          userEmails
        }
      : dbNameOrOptions

  const dbName = opts.dbName
  const tenantId = opts.marketingTenantId ?? null
  const campaign = opts.campaignId ?? null
  const users = opts.userEmails

  return events.filter((item) => {
    if (!eventTagMatchesTenant(item.tag, dbName, tenantId)) return false
    if (users != null && !eventTagMatchesUsers(item.tag, users)) return false
    if (campaign && !eventTagMatchesCampaign(item.tag, campaign)) return false
    return true
  })
}

function localDayStartMs(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NaN
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Calendar-day start for an event instant in the client's timezone.
 * @param tzOffsetMinutes - `Date#getTimezoneOffset()` from the browser
 */
function clientLocalDayStartMs(iso: string, tzOffsetMinutes: number): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NaN
  const shifted = new Date(d.getTime() - tzOffsetMinutes * 60_000)
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  )
}

function ymdToClientDayMs(ymd: string, tzOffsetMinutes: number | null): number | null {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  if (tzOffsetMinutes == null) return new Date(y, m - 1, d).getTime()
  return Date.UTC(y, m - 1, d)
}

export function filterBrevoEventsByDateRange(
  events: BrevoTrackingEmailEvent[],
  fromYmd: string | null,
  toYmd: string | null,
  tzOffsetMinutes?: number | null
): BrevoTrackingEmailEvent[] {
  if (!fromYmd && !toYmd) return events

  const offset =
    typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes)
      ? tzOffsetMinutes
      : null

  return events.filter((ev) => {
    const iso = ev.date
    if (!iso?.trim()) return !fromYmd && !toYmd

    const day =
      offset == null ? localDayStartMs(iso) : clientLocalDayStartMs(iso, offset)
    if (Number.isNaN(day)) return true

    const fromMs = fromYmd ? ymdToClientDayMs(fromYmd, offset) : null
    const toMs = toYmd ? ymdToClientDayMs(toYmd, offset) : null
    if (fromMs != null && day < fromMs) return false
    if (toMs != null && day > toMs) return false
    return true
  })
}
