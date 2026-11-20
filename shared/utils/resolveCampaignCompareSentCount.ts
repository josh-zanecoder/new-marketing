/**
 * Resolve the Compare-table **Sent** denominator for one campaign.
 *
 * Campaign details expose two related numbers:
 * - Recipients summary → CampaignRecipient rows with status `sent`
 * - SMTP / Emails sent card → stored tracking `requests`
 *
 * Prefer the recipient ledger (same as Details → Recipients → Sent). If the ledger
 * is empty but tracking already recorded sends, keep SMTP `requests` so Compare does
 * not force Sent to 0 and wipe real delivery stats.
 */
export function resolveCampaignCompareSentCount(input: {
  recipientSent: number
  smtpRequests: number
}): number {
  const recipientSent = Math.max(0, Math.floor(Number(input.recipientSent) || 0))
  const smtpRequests = Math.max(0, Math.floor(Number(input.smtpRequests) || 0))
  return recipientSent > 0 ? recipientSent : smtpRequests
}
