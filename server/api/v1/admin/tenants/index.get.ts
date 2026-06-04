import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import type { RegistryTenantDoc, TenantAdminRow } from '@server/types/registry/registryTenant.types'
import { toTenantAdminRow } from '@server/utils/registry/tenantAdminRow'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const registryConn = await getRegistryConnection()

  const rawDocs = (await registryConn
    .collection('clients')
    .find({})
    .sort({ createdAt: -1 })
    .toArray()) as unknown[]

  const tenants: TenantAdminRow[] = rawDocs
    .map((d) => toTenantAdminRow(d as RegistryTenantDoc))
    .filter((c): c is TenantAdminRow => !!c)

  return { tenants }
})
