export type CampaignCreatorSnapshot = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export type CampaignCreatorFields = {
  ownerEmail?: string | null
  createdBy?: string | null
  creator?: CampaignCreatorSnapshot | null
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Name and email of the user who created and owns the campaign. */
export function campaignCreatorLabel(fields: CampaignCreatorFields): string {
  const name = [clean(fields.creator?.firstName), clean(fields.creator?.lastName)]
    .filter(Boolean)
    .join(' ')
  const createdBy = clean(fields.createdBy)
  const email =
    clean(fields.ownerEmail) ||
    clean(fields.creator?.email) ||
    (createdBy.includes('@') ? createdBy : '')
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} · ${email}`
  }
  return name || email
}
