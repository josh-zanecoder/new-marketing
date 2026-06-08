import type {
  CampaignContactPickerRow,
  TenantContactTypeOption,
  TenantRecipientListPickerPayload
} from '~/types/tenantContact'

export function mapRecipientListPickerToCatalog(res: TenantRecipientListPickerPayload): {
  rows: CampaignContactPickerRow[]
  typeCounts: Record<string, number> | null
  typeOptions: TenantContactTypeOption[]
  truncated: boolean
} {
  const typeOptions = Array.isArray(res.contactTypes) ? res.contactTypes : []
  const cc = res.contactCounts
  const typeCounts =
    cc && typeof cc === 'object'
      ? Object.fromEntries(
          Object.entries(cc as Record<string, unknown>).map(([k, v]) => [
            String(k).trim().toLowerCase(),
            Number(v) || 0
          ])
        )
      : null

  const fallbackKey =
    typeOptions.length > 0
      ? String(
          typeOptions.find((t) => t.enabled !== false)?.key ?? typeOptions[0]?.key ?? ''
        )
          .trim()
          .toLowerCase()
      : ''

  const rows = (Array.isArray(res.contacts) ? res.contacts : [])
    .map((c) => {
      const rawTypes = Array.isArray(c.contactType) ? c.contactType : []
      const typeKeys = [
        ...new Set(rawTypes.map((k) => String(k).trim().toLowerCase()).filter(Boolean))
      ]
      const keys = typeKeys.length ? typeKeys : fallbackKey ? [fallbackKey] : []
      return {
        id: c.id,
        name: (c.name ?? '').trim(),
        email: (c.email ?? '').trim(),
        company: (c.company ?? '').trim() || undefined,
        contactType: keys
      }
    })
    .filter((c) => c.email.includes('@'))

  return {
    rows,
    typeCounts,
    typeOptions,
    truncated: Boolean(res.contactsTruncated)
  }
}
