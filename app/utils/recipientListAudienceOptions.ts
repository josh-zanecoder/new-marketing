import type { TenantContactTypeOption } from '~/types/tenantContact'

type RegistryFilterOptionSource = {
  enabled: boolean
  contactType: string
}

type AudienceOptionSource = {
  recipientFilters?: RegistryFilterOptionSource[]
  contactTypes?: TenantContactTypeOption[]
  contactCounts?: Record<string, number>
}

/** Build sorted audience filter / picker options from registry metadata. */
export function buildRecipientListAudienceOptions(
  source: AudienceOptionSource | null | undefined
): { value: string; label: string }[] {
  if (!source) return []

  const seen = new Set<string>()
  for (const filter of source.recipientFilters ?? []) {
    if (filter.enabled && filter.contactType.trim()) {
      seen.add(filter.contactType.trim().toLowerCase())
    }
  }
  for (const type of source.contactTypes ?? []) {
    if (type.enabled === false) continue
    const key = String(type.key ?? '')
      .trim()
      .toLowerCase()
    if (key) seen.add(key)
  }
  if (!seen.size) return []

  const labelByKey = new Map<string, string>()
  const orderByKey = new Map<string, number>()
  for (const type of source.contactTypes ?? []) {
    const key = String(type.key ?? '')
      .trim()
      .toLowerCase()
    if (!key) continue
    labelByKey.set(key, String(type.label ?? '').trim() || key)
    orderByKey.set(key, Number(type.sortOrder ?? 0))
  }

  const counts = source.contactCounts
  const keys = [...seen].sort((a, b) => {
    const orderA = orderByKey.has(a) ? orderByKey.get(a)! : 9999
    const orderB = orderByKey.has(b) ? orderByKey.get(b)! : 9999
    if (orderA !== orderB) return orderA - orderB
    return a.localeCompare(b)
  })

  return keys.map((value) => {
    const baseLabel =
      labelByKey.get(value) ?? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
    const count = counts?.[value]
    const label =
      typeof count === 'number' && Number.isFinite(count)
        ? `${baseLabel} (${count.toLocaleString()})`
        : baseLabel
    return { value, label }
  })
}
