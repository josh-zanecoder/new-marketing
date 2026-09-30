/**
 * Brevo UI / API type → Mongo `event` values we may have stored.
 * Must cover every label `metricKeyForEvent` rolls into that metric, or the
 * Messages table can show empty while the statistic card is non-zero
 * (SES/zcMail aliases, Brevo variants, pre-normalize leftovers).
 */
export function mongoEventValuesForFilter(eventType: string | null): string[] | null {
  if (!eventType?.trim()) return null
  const t = eventType.trim().toLowerCase()
  const compact = t.replace(/[_\s-]+/g, '')

  if (compact === 'requests' || compact === 'sent' || compact === 'request' || compact === 'send') {
    return ['requests', 'sent', 'request', 'send']
  }

  if (compact === 'delivered' || compact === 'delivery') {
    return ['delivered', 'delivery']
  }

  // Include plain opens: SES/zcMail only store `opened`, while aggregate derives
  // Trackable openers (uniqueOpens) from those rows when no unique_opened exists.
  if (
    compact === 'uniqueopened' ||
    compact === 'firstopening' ||
    t === 'unique_opened'
  ) {
    return [
      'unique_opened',
      'uniqueopened',
      'firstopening',
      'first_opening',
      'opened',
      'open',
      'opens'
    ]
  }

  if (compact === 'opened' || compact === 'opens' || compact === 'open') {
    return [
      'opened',
      'open',
      'opens',
      'unique_opened',
      'uniqueopened',
      'firstopening',
      'first_opening'
    ]
  }

  if (compact === 'clicks' || compact === 'click' || compact === 'clicked') {
    return ['clicks', 'click', 'clicked']
  }

  if (compact === 'bounces' || compact === 'bounce') {
    return [
      'hardBounces',
      'hard_bounces',
      'hardbounce',
      'hard_bounce',
      'softBounces',
      'soft_bounces',
      'softbounce',
      'soft_bounce',
      'bounces',
      'bounce',
      'bounced',
      'failed'
    ]
  }

  // Aggregate maps bounce/bounces/failed → hardBounces (metricKeyForEvent).
  if (compact === 'hardbounces' || compact === 'hardbounce') {
    return [
      'hardBounces',
      'hard_bounces',
      'hardbounce',
      'hard_bounce',
      'bounces',
      'bounce',
      'bounced',
      'failed'
    ]
  }

  if (compact === 'softbounces' || compact === 'softbounce') {
    return ['softBounces', 'soft_bounces', 'softbounce', 'soft_bounce']
  }

  if (compact === 'deferred' || compact === 'deliverydelay') {
    return ['deferred', 'deliverydelay', 'delivery_delay']
  }

  if (compact === 'invalid') return ['invalid']

  // Aggregate maps reject → blocked.
  if (compact === 'blocked' || compact === 'reject') {
    return ['blocked', 'reject']
  }

  if (compact === 'spam' || compact === 'complaint') {
    return ['spam', 'complaint']
  }

  if (compact === 'unsubscribed' || compact === 'unsubscribe') {
    return ['unsubscribed', 'unsubscribe']
  }

  if (compact === 'loadedbyproxy' || compact === 'proxyopen') {
    return ['loadedByProxy', 'loaded_by_proxy', 'proxy_open']
  }

  if (compact === 'error' || compact === 'renderingfailure') {
    return ['error', 'renderingfailure', 'rendering_failure']
  }

  return [eventType.trim()]
}
