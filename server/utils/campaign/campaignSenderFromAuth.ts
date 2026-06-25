import type { ResolvedCampaignSenderDefaults } from '@server/utils/campaign/resolveDefaultCampaignSender'

/**
 * Campaign `sender` stored on save: verified From email plus admin default name
 * (fallback when a contact has no CRM account owner at send time).
 * Per-recipient From names are resolved from each contact's owner when sending.
 */
export function resolveCampaignSenderForPersistence(
  _auth: unknown,
  defaults: ResolvedCampaignSenderDefaults,
  body?: { senderEmail?: string }
): { name: string; email: string } {
  return {
    name: defaults.name,
    email: body?.senderEmail?.trim() || defaults.email
  }
}
