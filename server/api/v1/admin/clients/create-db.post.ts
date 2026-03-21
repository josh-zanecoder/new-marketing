import { getRegistryConnection } from '../../../../utils/db'
import { ensureClientDatabaseInitialized } from '../../../../utils/clientDb'
import { isAdminAuthContext } from '../../../../utils/roles'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ name?: string; email?: string; tenantId?: string }>(event)
  const clientName = body?.name?.trim()
  const clientEmail = body?.email?.trim().toLowerCase()
  const tenantId = body?.tenantId?.trim() || null

  if (!clientName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const registryConn = await getRegistryConnection()
  const { dbName, clientKey, tenantId: resolvedTenantId } =
    await ensureClientDatabaseInitialized(
      registryConn,
      clientName,
      clientEmail || null,
      tenantId
    )

  return {
    ok: true,
    dbName,
    tenantId: resolvedTenantId,
    clientKey: clientKey ?? undefined
  }
})

