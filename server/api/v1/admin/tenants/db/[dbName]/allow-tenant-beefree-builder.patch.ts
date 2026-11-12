import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantBeefreeBuilder } from '~~/shared/allowTenantBeefreeBuilder'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

/**
 * Superadmin-only: toggle whether this tenant may open the Beefree email builder.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const raw = getRouterParam(event, 'dbName') ?? ''
  const dbName = decodeURIComponent(raw)
  if (!dbName) {
    throw createError({ statusCode: 400, message: 'Missing tenant db name' })
  }

  const body = await readBody<{ allowTenantBeefreeBuilder?: unknown }>(event)
  if (typeof body?.allowTenantBeefreeBuilder !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'allowTenantBeefreeBuilder is required (boolean)'
    })
  }
  const allowTenantBeefreeBuilder = parseAllowTenantBeefreeBuilder(body.allowTenantBeefreeBuilder)

  const registryConn = await getRegistryConnection()
  const existing = (await registryConn
    .collection('clients')
    .findOne({ dbName })) as RegistryTenantDoc | null

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  await registryConn.collection('clients').updateOne(
    { dbName },
    { $set: { allowTenantBeefreeBuilder } }
  )

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
