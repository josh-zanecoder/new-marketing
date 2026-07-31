const BREVO_MAX_DATE_RANGE_DAYS = 90

/** Brevo `getEmailEventReport` page size — OpenAPI maximum is 5000 (default 2500). */
export const BREVO_EVENTS_PAGE_LIMIT = 5000

function toYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(ymd: string): Date | null {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function clampBrevoDateRange(
  fromYmd: string | null,
  toYmd: string | null,
  now: Date = new Date()
): { startDate: string; endDate: string } {
  const end = toYmd ? parseYmd(toYmd) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endDate = toYmdLocal(end ?? new Date())

  let start: Date
  if (fromYmd) {
    start = parseYmd(fromYmd) ?? new Date(endDate)
  } else {
    start = new Date(endDate)
    start.setDate(start.getDate() - (BREVO_MAX_DATE_RANGE_DAYS - 1))
  }

  const maxStart = new Date(endDate)
  maxStart.setDate(maxStart.getDate() - (BREVO_MAX_DATE_RANGE_DAYS - 1))
  if (start.getTime() < maxStart.getTime()) start = maxStart

  return { startDate: toYmdLocal(start), endDate }
}

/**
 * Single tag token used when sending (`campaign:…` or `db:…`).
 * Prefer campaign when present — matches Brevo Logs tag filter.
 */
export function buildBrevoEventReportTagToken(options: {
  dbName?: string | null
  campaignId?: string | null
}): string | undefined {
  const campaignId = options.campaignId?.trim()
  if (campaignId) return `campaign:${campaignId}`

  const dbName = options.dbName?.trim()
  if (dbName) return `db:${dbName}`

  return undefined
}

/**
 * Brevo `tags` query for GET /smtp/statistics/events.
 *
 * Official OpenAPI: “serialized and urlencoded array. To pass multiple tags,
 * a format of string separated by commas is used such as **one, two, three**”.
 * So a single tag is the plain token (e.g. `campaign:abc`), not a JSON array.
 *
 * @see https://developers.brevo.com/reference/get-email-event-report
 */
export function buildBrevoEventReportTagsFilter(options: {
  dbName?: string | null
  campaignId?: string | null
}): string | undefined {
  return buildBrevoEventReportTagToken(options)
}

/**
 * Join multiple tag tokens the way Brevo documents (`"one, two, three"`).
 */
export function joinBrevoEventReportTags(tokens: string[]): string | undefined {
  const parts = tokens.map((t) => t.trim()).filter(Boolean)
  if (!parts.length) return undefined
  return parts.join(', ')
}

/**
 * Maps UI / API `from`+`to` to Brevo date params.
 * Docs: omit dates → last 30 days; `days` max 90 and incompatible with start/end.
 * We pass `days: 90` when the UI “Last 90 days” preset has no explicit range.
 */
export function resolveBrevoEventReportRequest(
  fromYmd: string | null,
  toYmd: string | null,
  now: Date = new Date()
): { startDate?: string; endDate?: string; days?: number } {
  if (!fromYmd && !toYmd) {
    return { days: BREVO_MAX_DATE_RANGE_DAYS }
  }
  return clampBrevoDateRange(fromYmd, toYmd, now)
}
