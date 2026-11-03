/**
 * LO recipient-list flag path: Save campaign stays clickable; missing required
 * fields are listed on click instead of disabling the button (classic unchanged).
 */

export type CampaignSaveRequiredFlags = {
  hasName: boolean
  hasRecipients: boolean
  hasDesign: boolean
  hasSubject: boolean
}

/** Labels for incomplete required campaign-save fields (stable display order). */
export function missingCampaignSaveFieldLabels(
  flags: CampaignSaveRequiredFlags
): string[] {
  const missing: string[] = []
  if (!flags.hasName) missing.push('Campaign name')
  if (!flags.hasRecipients) missing.push('Recipients')
  if (!flags.hasDesign) missing.push('Design')
  if (!flags.hasSubject) missing.push('Subject')
  return missing
}

/** User-facing banner when Save is clicked with incomplete required fields. */
export function campaignSaveMissingFieldsMessage(
  flags: CampaignSaveRequiredFlags
): string | null {
  const missing = missingCampaignSaveFieldLabels(flags)
  if (!missing.length) return null
  if (missing.length === 1) {
    return `${missing[0]} is required before saving.`
  }
  return `Complete these required fields before saving: ${missing.join(', ')}.`
}
