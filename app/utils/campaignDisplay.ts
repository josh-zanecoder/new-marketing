import type { Campaign } from '~/types/campaign'

export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Human-readable time until scheduled send (updates with `nowMs`). */
export function scheduleRemainingUntil(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = t - nowMs
  if (diff <= 0) return 'Send time reached'
  const minTotal = Math.floor(diff / 60000)
  const day = Math.floor(minTotal / 1440)
  const hr = Math.floor((minTotal % 1440) / 60)
  const min = minTotal % 60
  if (day >= 1) return `in ${day} day${day === 1 ? '' : 's'}`
  if (hr >= 1) return `in ${hr} hour${hr === 1 ? '' : 's'}${min > 0 ? ` ${min} min` : ''}`
  if (min >= 1) return `in ${min} min`
  return 'in less than a minute'
}

export function formatScheduledDateTime(iso: string): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Subtitle under campaign title: "Sending Apr 7 • 2:16 AM", "Sent Apr 6", etc. */
export function campaignSubtitle(c: Campaign, nowMs: number): string {
  if (c.status === 'Scheduled' && c.scheduledAt) {
    const d = new Date(c.scheduledAt)
    if (Number.isNaN(d.getTime())) return 'Scheduled'
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const when = `Sending ${md} • ${t}`
    const rem = scheduleRemainingUntil(c.scheduledAt, nowMs)
    return rem && rem !== 'Send time reached' ? `${when} • ${rem}` : when
  }
  if (c.status === 'Sent') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return 'Sent'
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Sent ${md}`
  }
  if (c.status === 'Sending') {
    return 'Sending in progress'
  }
  if (c.status === 'Failed') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return 'Failed'
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Failed ${md}`
  }
  if (c.status === 'Paused') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return 'Paused'
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Paused ${md}`
  }
  if (c.status === 'Cancelled') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return 'Cancelled'
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Cancelled ${md}`
  }
  if (c.createdAt) {
    const d = new Date(c.createdAt)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Created ${md}`
  }
  return 'Draft'
}
