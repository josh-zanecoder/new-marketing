import {
  isFirebaseTenantAuthContext,
  isTenantApiKeyAuthContext
} from '@server/tenant/registry-auth'

export default defineEventHandler((event) => {
  const auth = event.context.auth as unknown

  if (isTenantApiKeyAuthContext(auth)) {
    return {
      ok: true as const,
      user: {
        authType: 'apiKey' as const,
        role: 'tenant' as const,
        tenantName: auth.tenantName,
        dbName: auth.dbName,
        ...(auth.tenantId ? { tenantId: auth.tenantId } : {}),
        ...(auth.crmAppUrl ? { crmAppUrl: auth.crmAppUrl } : {}),
        ...(auth.tenantUserId ? { tenantUserId: auth.tenantUserId } : {}),
        ...(auth.tenantUserEmail ? { email: auth.tenantUserEmail } : {}),
        ...(auth.tenantUserName ? { name: auth.tenantUserName } : {}),
        ...(auth.tenantUserFirstName ? { firstName: auth.tenantUserFirstName } : {}),
        ...(auth.tenantUserLastName ? { lastName: auth.tenantUserLastName } : {}),
        ...(auth.tenantUserPhone ? { phone: auth.tenantUserPhone } : {}),
        ...(auth.tenantUserRole ? { tenantRole: auth.tenantUserRole } : {}),
        ...(auth.tenantWideContacts ? { tenantWideContacts: true as const } : {}),
        ...(auth.contactOwnerScope?.length
          ? { contactOwnerEmails: auth.contactOwnerScope }
          : {})
      }
    }
  }

  if (isFirebaseTenantAuthContext(auth)) {
    return {
      ok: true as const,
      user: {
        authType: 'firebase' as const,
        uid: auth.uid,
        email: auth.email,
        role: auth.role,
        tenantId: auth.tenantId,
        dbName: auth.dbName,
        ...(auth.crmAppUrl ? { crmAppUrl: auth.crmAppUrl } : {})
      }
    }
  }

  if (auth && typeof auth === 'object') {
    const a = auth as Record<string, unknown>
    if (
      typeof a.uid === 'string' &&
      typeof a.email === 'string' &&
      a.role === 'admin' &&
      !a.tenantId
    ) {
      return {
        ok: true as const,
        user: {
          authType: 'firebase' as const,
          uid: a.uid,
          email: a.email,
          role: 'admin' as const,
          tenantId: null,
          dbName: null
        }
      }
    }
  }

  throw createError({ statusCode: 401, message: 'Unauthorized' })
})
