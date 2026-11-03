import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

/**
 * Superadmin-only: toggle whether this tenant may create LO-scoped recipient lists.
 * Does not change existing lists when flipped.
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

  const body = await readBody<{ allowTenantLoRecipientLists?: unknown }>(event)
  if (typeof body?.allowTenantLoRecipientLists !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'allowTenantLoRecipientLists is required (boolean)'
    })
  }
  const allowTenantLoRecipientLists = parseAllowTenantLoRecipientLists(
    body.allowTenantLoRecipientLists
  )

  const registryConn = await getRegistryConnection()
  const existing = (await registryConn
    .collection('clients')
    .findOne({ dbName })) as RegistryTenantDoc | null

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  await registryConn.collection('clients').updateOne(
    { dbName },
    { $set: { allowTenantLoRecipientLists } }
  )

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
