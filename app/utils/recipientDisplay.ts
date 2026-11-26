import {
  marketingStatusCategoryKeyFromToken,
  marketingStatusCategoryOf
} from '~~/shared/marketingStatusCategories'

/** Up to two initials from a name or email, for a recipient avatar. */
export function recipientInitials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (first + last).toUpperCase()
}

const AVATAR_TONES = [
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800'
]

/** Stable avatar colour for a seed (the same person always gets the same colour). */
export function recipientAvatarTone(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]!
}

/** Colour cue for a status or a marketing category (dot on the pill, tint on the badge). */
export function recipientStatusTone(value: string): { dot: string, badge: string } {
  const key = marketingStatusCategoryKeyFromToken(value) ?? marketingStatusCategoryOf(value)
  switch (key) {
    case 'new_active_leads':
      return { dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700' }
    case 'active_borrowers':
      return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' }
    case 'past_clients':
      return { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' }
    case 'inactive_leads':
      return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' }
    case 'on_hold':
      return { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700' }
    default:
      return { dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700' }
  }
}
