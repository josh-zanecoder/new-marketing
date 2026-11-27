import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantLendingQbStatus } from '~~/shared/allowTenantLendingQbStatus'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'
import { invalidateLendingQbStatusFeatureCache } from '@server/utils/recipient/lendingQbStatusFeature'

/**
 * Superadmin-only: toggle the LendingQB loan-status integration for a tenant.
 * When ON, the marketing borrower-status categories (New & Active Leads, Active Borrowers,
 * Past Clients, Inactive Leads, On Hold) are driven by the LendingQB loan status synced from the
 * CRM. When OFF, categories keep using the existing keyword rules on the borrower status.
 * Does not delete synced loan statuses and does not rewrite existing recipient lists.
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

  const body = await readBody<{ allowTenantLendingQbStatus?: unknown }>(event)
  if (typeof body?.allowTenantLendingQbStatus !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'allowTenantLendingQbStatus is required (boolean)'
    })
  }
  const allowTenantLendingQbStatus = parseAllowTenantLendingQbStatus(
    body.allowTenantLendingQbStatus
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
    { $set: { allowTenantLendingQbStatus } }
  )
  invalidateLendingQbStatusFeatureCache(dbName)

  if (allowTenantLendingQbStatus) {
    // The one-contact-per-email protection is part of this integration: clean up any existing
    // duplicates now instead of waiting for the next scheduled sweep. Never blocks or fails the PATCH.
    void import('@server/services/mergeDuplicateContacts')
      .then(({ sweepDuplicateContactsForDb }) => sweepDuplicateContactsForDb(dbName))
      .catch((err) => {
        console.warn('[ContactDuplicateMerge] sweep after LendingQB enable failed', {
          dbName,
          error: err instanceof Error ? err.message : String(err)
        })
      })
  }

  const doc = await registryConn.collection('clients').findOne({ dbName })
  const tenant = doc ? toTenantAdminRow(doc as RegistryTenantDoc) : null
  if (!tenant) {
    throw createError({ statusCode: 500, message: 'Failed to load updated tenant' })
  }

  return { ok: true, tenant }
})
