import { getRegistryConnection } from '../../../../lib/mongoose'
import { ensureTenantDatabaseInitialized } from '../../../../tenant/provisioning'
import { isAdminAuthContext } from '../../../../tenant/registry-auth'
import { createTenantUser } from '../../../../services/tenantUser.service'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ name?: string; email?: string; tenantId?: string; subdomain?: string }>(
    event
  )
  const displayName = body?.name?.trim()
  const contactEmail = body?.email?.trim().toLowerCase()
  const tenantId = body?.tenantId?.trim() || null
  const subdomain = body?.subdomain?.trim() ? body.subdomain : null

  if (!displayName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const registryConn = await getRegistryConnection()
  const { dbName, apiKey, tenantId: resolvedTenantId } =
    await ensureTenantDatabaseInitialized(
      registryConn,
      displayName,
      contactEmail || null,
      tenantId,
      subdomain
    )

  if (apiKey && contactEmail && resolvedTenantId) {
    try {
      await createTenantUser(contactEmail, resolvedTenantId)
    } catch (err) {
      console.error('Failed to create tenant user:', err)
      throw createError({
        statusCode: 500,
        message: 'Tenant created but failed to create user account. You may need to create the user manually.'
      })
    }
  }

  return {
    ok: true,
    dbName,
    tenantId: resolvedTenantId,
    apiKey: apiKey ?? undefined
  }
})
