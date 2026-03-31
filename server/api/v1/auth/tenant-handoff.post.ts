import { getRegistryConnection } from '../../../lib/mongoose'
import { hashTenantApiKey } from '../../../tenant/api-key'
import { findRegistryTenantByApiKey } from '../../../tenant/registry-auth'
import { parseMarketingHandoffToken } from '../../../utils/marketingHandoffJwt'
import { signMarketingTenantBrowserSession } from '../../../utils/marketingTenantBrowserSession'
import {
  MARKETING_TENANT_BRIDGE_COOKIE,
  MARKETING_TENANT_SESSION_COOKIE,
  TENANT_AUTH_COOKIE_MAX_AGE
} from '../../../constants/tenantAuth.constants'

interface Body {
  token?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const token = body?.token?.trim()
  if (!token) {
    throw createError({ statusCode: 400, message: 'Missing token' })
  }

  let parsed: ReturnType<typeof parseMarketingHandoffToken>
  try {
    parsed = parseMarketingHandoffToken(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Invalid or expired handoff token' })
  }

  const {
    apiKey,
    marketingTenantId,
    email: handoffEmail,
    firstName: handoffFirstName,
    lastName: handoffLastName,
    phone: handoffPhone,
    role: handoffRole,
    allowedOwnerEmails,
    tenantWideContacts
  } = parsed
  if (!apiKey.startsWith('nmk_')) {
    throw createError({ statusCode: 400, message: 'Invalid tenant key material' })
  }

  const registryConn = await getRegistryConnection()
  const row = await findRegistryTenantByApiKey(registryConn, apiKey)
  if (!row) {
    throw createError({ statusCode: 401, message: 'Unknown API key' })
  }

  if (
    marketingTenantId &&
    row.tenantId &&
    row.tenantId !== marketingTenantId
  ) {
    throw createError({ statusCode: 401, message: 'Handoff tenant mismatch' })
  }

  const clientKeyHash = hashTenantApiKey(apiKey)
  const sessionJwt = signMarketingTenantBrowserSession({
    dbName: row.dbName,
    tenantId: row.tenantId ?? null,
    clientKeyHash,
    maxAgeSec: TENANT_AUTH_COOKIE_MAX_AGE,
    ...(handoffEmail ? { crmHandoffEmail: handoffEmail } : {}),
    ...(handoffFirstName ? { crmHandoffFirstName: handoffFirstName } : {}),
    ...(handoffLastName ? { crmHandoffLastName: handoffLastName } : {}),
    ...(handoffPhone ? { crmHandoffPhone: handoffPhone } : {}),
    ...(handoffRole ? { crmHandoffRole: handoffRole } : {}),
    ...(tenantWideContacts === true
      ? { tenantWideContacts: true }
      : allowedOwnerEmails?.length
        ? { contactOwnerEmails: allowedOwnerEmails }
        : {})
  })

  const secure = process.env.NODE_ENV === 'production'
  const base = { path: '/', sameSite: 'lax' as const, maxAge: TENANT_AUTH_COOKIE_MAX_AGE, secure }

  deleteCookie(event, 'marketing_token', { path: '/' })

  setCookie(event, MARKETING_TENANT_SESSION_COOKIE, sessionJwt, { ...base, httpOnly: true })
  setCookie(event, MARKETING_TENANT_BRIDGE_COOKIE, '1', { ...base, httpOnly: false })

  return { ok: true as const, tenantName: row.tenantName }
})
