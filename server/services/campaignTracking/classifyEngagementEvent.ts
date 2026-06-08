import type { CampaignTrackingSummary } from './types'

const SENT_EVENTS = new Set(['request', 'requests', 'sent'])
const DELIVERED_EVENTS = new Set(['delivered', 'delivery'])
const OPENED_EVENTS = new Set(['opened', 'open', 'unique_opened'])
const CLICKED_EVENTS = new Set(['click', 'clicked', 'unique_click'])
const BOUNCED_EVENTS = new Set(['hard_bounce', 'soft_bounce', 'bounce', 'blocked', 'invalid'])
const COMPLAINT_EVENTS = new Set(['complaint', 'spam'])
const UNSUB_EVENTS = new Set(['unsubscribed', 'unsubscribe'])

export type EngagementBucket = keyof CampaignTrackingSummary['totals']

export function classifyEngagementEvent(event: string): EngagementBucket | 'other' {
  const e = event.toLowerCase()
  if (SENT_EVENTS.has(e)) return 'sent'
  if (DELIVERED_EVENTS.has(e)) return 'delivered'
  if (OPENED_EVENTS.has(e)) return 'opened'
  if (CLICKED_EVENTS.has(e)) return 'clicked'
  if (BOUNCED_EVENTS.has(e)) return 'bounced'
  if (COMPLAINT_EVENTS.has(e)) return 'complained'
  if (UNSUB_EVENTS.has(e)) return 'unsubscribed'
  return 'other'
}
