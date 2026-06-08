import type { H3Event } from 'h3'

const MONGO_OBJECT_ID_RE = /^[a-f\d]{24}$/i

export function parseCampaignIdQuery(event: H3Event): string | null {
  const raw = getQuery(event).campaignId
  const value =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw) && typeof raw[0] === 'string'
        ? raw[0].trim()
        : ''
  if (!value || !MONGO_OBJECT_ID_RE.test(value)) return null
  return value
}
