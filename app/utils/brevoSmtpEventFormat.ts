/** Ratesheet-style Brevo event labels for the stats recipients table. */
export function formatBrevoSmtpEventLabel(raw: string | undefined): string {
  const u = String(raw || '').trim()
  const k = u.toLowerCase()
  const normalized = k.replace(/[_\s-]+/g, '')
  if (!k) return '—'
  if (normalized === 'sent' || normalized === 'request' || normalized === 'requests') return 'Sent'
  if (normalized === 'delivered') return 'Delivered'
  if (normalized === 'bounce' || normalized === 'bounces') return 'Bounced'
  if (normalized === 'hardbounce' || normalized === 'hardbounces') return 'Hard Bounced'
  if (normalized === 'softbounce' || normalized === 'softbounces') return 'Soft Bounced'
  if (normalized === 'blocked') return 'Blocked'
  if (normalized === 'invalid') return 'Invalid'
  if (normalized === 'deferred') return 'Deferred'
  if (normalized === 'error') return 'Error'
  if (normalized === 'spam' || normalized === 'complaint') return 'Complaint'
  if (normalized === 'unsubscribed') return 'Unsubscribed'
  if (normalized === 'opened') return 'Opened'
  if (normalized === 'uniqueopened' || normalized === 'firstopening') return 'First opening'
  if (normalized === 'proxyopened') return 'Proxy open'
  if (normalized === 'uniqueproxyopened') return 'Unique proxy open'
  if (normalized === 'click' || normalized === 'clicks' || normalized === 'clicked') return 'Clicked'
  if (normalized === 'uniqueclicked' || normalized === 'uniqueclick') return 'Unique click'
  return u.charAt(0).toUpperCase() + u.slice(1)
}

export function formatBrevoSmtpEventTableDate(iso: string | undefined): string {
  if (!iso?.trim()) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function brevoSmtpEventBadgeClass(event: string | undefined): string {
  const e = String(event || '')
    .trim()
    .toLowerCase()
  if (!e) return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
  if (e === 'delivered') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  if (e === 'requests' || e === 'sent' || e === 'request')
    return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (e.includes('bounce') || e === 'hard_bounces' || e === 'soft_bounces')
    return 'bg-red-50 text-red-800 ring-red-200/80'
  if (e === 'unique_opened' || e.includes('open'))
    return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (e.includes('click')) return 'bg-amber-50 text-amber-800 ring-amber-200/80'
  if (e === 'spam' || e === 'complaint') return 'bg-orange-50 text-orange-900 ring-orange-200/80'
  if (e === 'blocked' || e === 'invalid' || e === 'error')
    return 'bg-red-50 text-red-800 ring-red-200/80'
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200/80'
}
