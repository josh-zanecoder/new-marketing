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
  return tagStr.split(',').map((p) => p.trim()).filter(Boolean)
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

function eventTagMatchesCampaign(tagStr: string | undefined, campaignId: string): boolean {
  return parseTagSegments(tagStr).includes(`campaign:${campaignId}`)
}

export function extractBrevoEventsFromReport(report: unknown): BrevoTrackingEmailEvent[] {
  if (report == null || typeof report !== 'object') return []
  const raw = (report as { events?: unknown }).events
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is BrevoTrackingEmailEvent => item != null && typeof item === 'object')
}

export function filterBrevoEventsForTenant(
  events: BrevoTrackingEmailEvent[],
  dbName: string,
  marketingTenantId: string | null,
  campaignId: string | null
): BrevoTrackingEmailEvent[] {
  return events.filter((item) => {
    if (!eventTagMatchesTenant(item.tag, dbName, marketingTenantId)) return false
    if (campaignId && !eventTagMatchesCampaign(item.tag, campaignId)) return false
    return true
  })
}
