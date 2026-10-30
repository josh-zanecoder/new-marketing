import type { H3Event } from 'h3'
import { getRegistryConnection } from '../lib/mongoose'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext,
  isTenantApiKeyAuthContext,
  resolveTenantIdForTenantAuth,
  findRegistryTenantByDbName,
  tenantUserEmailFromAuth
} from './registry-auth'
import { resolveCampaignSenderDefaultsFromDoc } from '@server/utils/campaign/resolveDefaultCampaignSender'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantEditSender } from '~~/shared/allowTenantEditSender'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import { tenantUserFieldsFromAuth } from '@server/utils/emailMerge/tenantUserFromAuth'
import { formatPersonDisplayName } from '~~/shared/formatPersonDisplayName'
import { marketingAudienceAccessPayload } from '@server/utils/auth/marketingAudienceFromAuth'

export async function buildTenantMeResponse(event: H3Event) {
  const auth = event.context.auth as unknown
  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (isAdminAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Tenant-scoped routes require a tenant session or tenant API key'
    })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Missing or invalid tenant context'
    })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)
  const registryDoc = (await registryConn
    .collection('clients')
    .findOne({ dbName: auth.dbName })) as RegistryTenantDoc | null
  const row = await findRegistryTenantByDbName(registryConn, auth.dbName)
  const senderDefaults = resolveCampaignSenderDefaultsFromDoc(registryDoc)

  const tenantNameFromKey = isTenantApiKeyAuthContext(auth)
    ? auth.tenantName
    : null

  const crmFromAuth =
    'crmAppUrl' in auth && typeof auth.crmAppUrl === 'string' && auth.crmAppUrl.trim()
      ? auth.crmAppUrl.trim()
      : null

  const sessionFields = tenantUserFieldsFromAuth(auth)
  const sessionEmail =
    (sessionFields?.email || tenantUserEmailFromAuth(auth) || '').trim().toLowerCase() || undefined
  const sessionDisplayName = formatPersonDisplayName({
    firstName: sessionFields?.firstName,
    lastName: sessionFields?.lastName,
    name:
      isTenantApiKeyAuthContext(auth) && typeof auth.tenantUserName === 'string'
        ? auth.tenantUserName
        : undefined
  })
  const sessionRole =
    isTenantApiKeyAuthContext(auth) && typeof auth.tenantUserRole === 'string'
      ? auth.tenantUserRole.trim()
      : ''
  const sessionUser =
    sessionEmail || sessionDisplayName || sessionFields?.firstName || sessionFields?.lastName
      ? {
          ...(sessionEmail ? { email: sessionEmail } : {}),
          ...(sessionFields?.firstName ? { firstName: sessionFields.firstName } : {}),
          ...(sessionFields?.lastName ? { lastName: sessionFields.lastName } : {}),
          ...(sessionDisplayName ? { name: sessionDisplayName } : {}),
          ...(sessionRole ? { role: sessionRole } : {})
        }
      : undefined

  const allowTenantLoRecipientLists = parseAllowTenantLoRecipientLists(
    registryDoc?.allowTenantLoRecipientLists
  )
  // Ensure audience payload sees the feature flag even if middleware omitted it.
  const authForAudience =
    allowTenantLoRecipientLists && isTenantApiKeyAuthContext(auth)
      ? { ...auth, allowTenantLoRecipientLists: true as const }
      : auth
  const { audienceAccess, canSelectAnyLoanOfficer } =
    marketingAudienceAccessPayload(authForAudience)

  return {
    tenantId: tenantId ?? row?.tenantId ?? null,
    dbName: auth.dbName,
    tenantName: row?.tenantName ?? tenantNameFromKey ?? null,
    crmAppUrl: crmFromAuth ?? row?.crmAppUrl ?? null,
    defaultCampaignSenderName: senderDefaults.name,
    defaultCampaignSenderEmail: senderDefaults.email,
    /** When false/omitted, campaign sender stays superadmin-managed (existing behavior). */
    allowTenantEditSender: parseAllowTenantEditSender(registryDoc?.allowTenantEditSender),
    /** When false/omitted, recipient lists keep classic UI/behavior. */
    allowTenantLoRecipientLists,
    /**
     * When LO-list flag ON: LO/LOA → self_only; OM/Marketing → tenant_wide.
     * When OFF: classic handoff (tenant_wide or owner_scope).
     */
    audienceAccess,
    canSelectAnyLoanOfficer,
    /** Logged-in LO / CRM user — preferred for sender UI display name. */
    ...(sessionUser ? { sessionUser } : {})
  }
}
