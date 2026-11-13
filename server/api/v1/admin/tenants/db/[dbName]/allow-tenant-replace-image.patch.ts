import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

/**
 * Superadmin-only: toggle whether this tenant may replace images already in email templates.
 * Stored as an explicit boolean so it no longer follows Insert image or the template builder.
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

  const body = await readBody<{ allowTenantReplaceImage?: unknown }>(event)
  if (typeof body?.allowTenantReplaceImage !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'allowTenantReplaceImage is required (boolean)'
    })
  }
  const allowTenantReplaceImage = body.allowTenantReplaceImage

  const registryConn = await getRegistryConnection()
  const existing = (await registryConn
    .collection('clients')
    .findOne({ dbName })) as RegistryTenantDoc | null

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  await registryConn.collection('clients').updateOne(
    { dbName },
    { $set: { allowTenantReplaceImage } }
  )

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
