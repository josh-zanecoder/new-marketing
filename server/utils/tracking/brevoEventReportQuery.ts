const BREVO_MAX_DATE_RANGE_DAYS = 90

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
 * Brevo `tags` query value: serialized JSON array of tag tokens.
 * Prefer the most specific token available (`campaign:` > `db:`).
 */
export function buildBrevoEventReportTagsFilter(options: {
  dbName?: string | null
  campaignId?: string | null
}): string | undefined {
  const campaignId = options.campaignId?.trim()
  if (campaignId) return JSON.stringify([`campaign:${campaignId}`])

  const dbName = options.dbName?.trim()
  if (dbName) return JSON.stringify([`db:${dbName}`])

  return undefined
}

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
