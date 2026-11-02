/** Client/server helpers for the LO-flag tenant Images gallery. */

export type TenantHostedImage = {
  id: string
  url: string
  objectPath: string
  fileName: string
  contentType: string
  size: number
  createdAt: string
}

export type TenantHostedImageDayGroup = {
  key: string
  label: string
  items: TenantHostedImage[]
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayLabel(d: Date, now: Date): string {
  const today = startOfLocalDay(now)
  const target = startOfLocalDay(d)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: target.getFullYear() === today.getFullYear() ? undefined : 'numeric'
  })
}

/** Group hosted images into Today / Yesterday / date sections (newest first). */
export function groupTenantHostedImagesByDay(
  items: TenantHostedImage[],
  now: Date = new Date()
): TenantHostedImageDayGroup[] {
  const map = new Map<string, TenantHostedImageDayGroup>()
  for (const item of items) {
    const created = new Date(item.createdAt)
    const when = Number.isNaN(created.getTime()) ? new Date(0) : created
    const key = dayKey(when)
    let group = map.get(key)
    if (!group) {
      group = { key, label: dayLabel(when, now), items: [] }
      map.set(key, group)
    }
    group.items.push(item)
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
}
