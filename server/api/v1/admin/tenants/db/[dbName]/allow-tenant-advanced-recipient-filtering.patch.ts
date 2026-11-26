import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantAdvancedRecipientFiltering } from '~~/shared/allowTenantAdvancedRecipientFiltering'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

/**
 * Superadmin-only: toggle Advanced Recipient Filtering for Marketing Campaigns.
 * When ON, campaign create/schedule can filter recipients with CRM Contacts filters.
 * Does not change existing campaigns or recipient lists when flipped.
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

  const body = await readBody<{ allowTenantAdvancedRecipientFiltering?: unknown }>(event)
  if (typeof body?.allowTenantAdvancedRecipientFiltering !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'allowTenantAdvancedRecipientFiltering is required (boolean)'
    })
  }
  const allowTenantAdvancedRecipientFiltering = parseAllowTenantAdvancedRecipientFiltering(
    body.allowTenantAdvancedRecipientFiltering
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
    { $set: { allowTenantAdvancedRecipientFiltering } }
  )

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
