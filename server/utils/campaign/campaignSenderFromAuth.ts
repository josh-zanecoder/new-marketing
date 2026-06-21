import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'
import { replyToNameFromUserSnapshot } from '@server/utils/email/replyToFromContactMetadata'
import type { ResolvedCampaignSenderDefaults } from '@server/utils/campaign/resolveDefaultCampaignSender'

/** Display name for campaign From header from the current tenant session / forwarded operator. */
export function campaignSenderDisplayNameFromAuth(auth: unknown): string {
  if (!isTenantApiKeyAuthContext(auth)) return ''
  const fromParts = replyToNameFromUserSnapshot({
    firstName: auth.tenantUserFirstName,
    lastName: auth.tenantUserLastName,
    email: auth.tenantUserEmail
  })
  if (fromParts) return fromParts
  return auth.tenantUserName?.trim() ?? ''
}

export function resolveCampaignSenderForPersistence(
  auth: unknown,
  defaults: ResolvedCampaignSenderDefaults,
  body?: { senderEmail?: string }
): { name: string; email: string } {
  return {
    name: campaignSenderDisplayNameFromAuth(auth) || defaults.name,
    email: body?.senderEmail?.trim() || defaults.email
  }
}
