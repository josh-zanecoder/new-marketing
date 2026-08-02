/**
 * Short explanations for transactional email event labels shown in Tracking.
 * Keys are lowercase; unknown types get a generic fallback.
 */
const EVENT_TYPE_TOOLTIPS: Record<string, string> = {
  all: 'Show every event type in this range.',
  requests: 'The message was sent.',
  sent: 'The message was sent.',
  delivered: 'The message reached the recipient’s mail server.',
  opened: 'The recipient opened the email.',
  unique_opened: 'First open recorded for this message.',
  open: 'The recipient opened the email.',
  clicks: 'The recipient clicked a link in the email.',
  click: 'The recipient clicked a link in the email.',
  hard_bounces: 'Permanent failure — address is invalid or rejected.',
  hardbounces: 'Permanent failure — address is invalid or rejected.',
  soft_bounces: 'Temporary failure — mailbox full, greylisting, or similar.',
  softbounces: 'Temporary failure — mailbox full, greylisting, or similar.',
  bounces: 'Delivery failed (hard or soft bounce).',
  bounce: 'Delivery failed (hard or soft bounce).',
  spam: 'The recipient marked the email as spam.',
  complaint: 'The recipient filed a spam complaint.',
  blocked: 'The send was blocked (policy, reputation, or list).',
  invalid: 'The address was rejected as invalid.',
  deferred: 'Delivery was delayed and will be retried.',
  unsubscribed: 'The recipient unsubscribed via the email link.',
  error: 'An error occurred while processing or sending.',
  loadedbyproxy: 'Open detected via a privacy proxy (e.g. Apple Mail Privacy).',
  loaded_by_proxy: 'Open detected via a privacy proxy (e.g. Apple Mail Privacy).'
}

export function brevoEventTypeTooltip(eventType: string | undefined | null): string {
  const key = (eventType || '').trim().toLowerCase()
  if (!key) return 'Email delivery event.'
  if (EVENT_TYPE_TOOLTIPS[key]) return EVENT_TYPE_TOOLTIPS[key]
  if (key.includes('open')) return EVENT_TYPE_TOOLTIPS.opened
  if (key.includes('click')) return EVENT_TYPE_TOOLTIPS.clicks
  if (key.includes('bounce')) return EVENT_TYPE_TOOLTIPS.bounces
  if (key.includes('proxy')) return EVENT_TYPE_TOOLTIPS.loadedbyproxy
  return `Event: ${eventType!.trim()}.`
}
