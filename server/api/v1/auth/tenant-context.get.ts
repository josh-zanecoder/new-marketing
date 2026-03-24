import { getRegistryConnection } from '../../../lib/mongoose'
import { findRegistryTenantBySubdomain } from '../../../tenant/registry-auth'
import { extractSubdomainFromHost, getHostFromEvent, getTenantBaseDomain, isTenantSubdomain } from '../../../utils/tenant-host'

export default defineEventHandler(async (event) => {
  const baseDomain = getTenantBaseDomain()
  const host = getHostFromEvent(event)
  const subdomain = extractSubdomainFromHost(host, baseDomain)
  if (!isTenantSubdomain(subdomain)) {
    return { ok: true, baseDomain, isTenantHost: false, subdomain: null, tenant: null }
  }
  const registryConn = await getRegistryConnection()
  const tenant = await findRegistryTenantBySubdomain(registryConn, subdomain)
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found for this subdomain' })
  return {
    ok: true,
    baseDomain,
    isTenantHost: true,
    subdomain,
    tenant: {
      tenantName: tenant.tenantName,
      dbName: tenant.dbName,
      tenantId: tenant.tenantId ?? null,
      firebaseTenantId: tenant.firebaseTenantId ?? null
    }
  }
})
