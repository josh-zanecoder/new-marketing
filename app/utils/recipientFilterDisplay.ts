import { formatRegistryLabelForDisplay } from '~/utils/registryLabelDisplay'

function normalized(raw: string): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function recipientFilterPropertyLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'relationship_partner') return 'Partner'
  return formatRegistryLabelForDisplay(raw)
}

export function recipientFilterPropertyTypeLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'partner_email') return 'Partner email'
  if (key === 'partner_external_id') return 'Partner external ID'
  if (key === 'partner_owner_email') return 'Partner owner email'
  if (key === 'partner_type') return 'Partner type'
  if (key === 'partner_name') return 'Partner name'
  return formatRegistryLabelForDisplay(raw)
}

export function recipientCriterionPropertyLabel(raw: string): string {
  const key = normalized(raw)
  if (key === 'related_partner_email') return 'Partner email'
  if (key === 'related_partner_external_id') return 'Partner external ID'
  if (key === 'related_partner_owner_email') return 'Partner owner email'
  if (key === 'related_partner_type') return 'Partner type'
  if (key === 'related_partner_name') return 'Partner name'
  if (key === 'relationship_partner') return 'Partner'
  return formatRegistryLabelForDisplay(raw)
}
