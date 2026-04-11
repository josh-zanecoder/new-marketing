/** Deterministic Tailwind badge classes for arbitrary contact-type keys (no hardcoded triad). */
const PALETTE = [
  'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
  'bg-violet-50 text-violet-800 ring-violet-200/80',
  'bg-amber-50 text-amber-900 ring-amber-200/70',
  'bg-sky-50 text-sky-900 ring-sky-200/80',
  'bg-rose-50 text-rose-900 ring-rose-200/80',
  'bg-teal-50 text-teal-900 ring-teal-200/70'
] as const

export function contactTypeKeyBadgeClass(key: string): string {
  const k = key.trim()
  if (!k) return 'bg-slate-100 text-slate-500 ring-slate-200/80'
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}
