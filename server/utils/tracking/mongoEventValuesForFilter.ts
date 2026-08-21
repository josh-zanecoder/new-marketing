/** Brevo UI / API type → Mongo `event` values we may have stored. */
export function mongoEventValuesForFilter(eventType: string | null): string[] | null {
  if (!eventType?.trim()) return null
  const t = eventType.trim().toLowerCase()
  if (t === 'requests' || t === 'sent' || t === 'request') {
    return ['requests', 'sent', 'request']
  }
  if (t === 'unique_opened' || t === 'uniqueopened' || t === 'firstopening') {
    return ['unique_opened', 'uniqueopened', 'firstopening']
  }
  if (t === 'opened' || t === 'opens' || t === 'open') {
    return ['opened', 'open', 'opens', 'unique_opened', 'uniqueopened']
  }
  if (t === 'clicks' || t === 'click' || t === 'clicked') {
    return ['clicks', 'click', 'clicked']
  }
  if (t === 'bounces' || t === 'bounce') {
    return [
      'hardBounces',
      'hard_bounces',
      'hardbounce',
      'softBounces',
      'soft_bounces',
      'softbounce',
      'bounces',
      'bounce'
    ]
  }
  if (t === 'hardbounces' || t === 'hard_bounces') {
    return ['hardBounces', 'hard_bounces', 'hardbounce']
  }
  if (t === 'softbounces' || t === 'soft_bounces') {
    return ['softBounces', 'soft_bounces', 'softbounce']
  }
  if (t === 'deferred') return ['deferred']
  if (t === 'invalid') return ['invalid']
  if (t === 'blocked') return ['blocked']
  if (t === 'spam') return ['spam', 'complaint']
  if (t === 'unsubscribed') return ['unsubscribed', 'unsubscribe']
  if (t === 'loadedbyproxy' || t === 'loaded_by_proxy') {
    return ['loadedByProxy', 'loaded_by_proxy']
  }
  if (t === 'error') return ['error']
  return [eventType.trim()]
}
