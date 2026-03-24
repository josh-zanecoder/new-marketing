import { getRegistryConnection } from '../../../lib/mongoose'
import User from '../../../models/admin/User'
import type { Model } from 'mongoose'
import type { IUser } from '../../../types/admin/user.model'
import {
  findRegistryTenantBySubdomain,
  findRegistryTenantByTenantId
} from '../../../tenant/registry-auth'
import {
  extractSubdomainFromHost,
  getHostFromEvent,
  getTenantBaseDomain,
  isTenantSubdomain
} from '../../../utils/tenant-host'

interface LoginBody {
  email?: string
}

export default defineEventHandler(async (event) => {
  const UserModel = User as unknown as Model<IUser>
  const body = await readBody<LoginBody>(event)
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'email is required in body'
    })
  }

  const registryConn = await getRegistryConnection()
  const mongoUser = await UserModel.findOne({ email }).lean()

  if (!mongoUser) {
    throw createError({
      statusCode: 403,
      message: 'User is not allowed to access this app'
    })
  }

<<<<<<< Updated upstream
  let subdomain: string | null = null
  const tenantId = typeof mongoUser.tenantId === 'string' ? mongoUser.tenantId.trim() : ''
  if (tenantId) {
    const row = await registryConn
      .collection('clients')
      .findOne({ tenantId })
      .then((d) => d as { subdomain?: string } | null)
    if (typeof row?.subdomain === 'string' && row.subdomain) subdomain = row.subdomain
  }

=======
  const role = String(mongoUser.role || '').toLowerCase()
  const tenantId = typeof mongoUser.tenantId === 'string' ? mongoUser.tenantId.trim() : ''
  const baseDomain = getTenantBaseDomain()
  const host = getHostFromEvent(event)
  const hostSubdomain = extractSubdomainFromHost(host, baseDomain)
  const hasTenantHost = isTenantSubdomain(hostSubdomain)
  const registryTenant = role === 'tenant' || role === 'client'
    ? (hasTenantHost
      ? await findRegistryTenantBySubdomain(registryConn, hostSubdomain)
      : await findRegistryTenantByTenantId(registryConn, tenantId))
    : null
  if ((role === 'tenant' || role === 'client') && !registryTenant) {
    throw createError({ statusCode: 403, message: 'No tenant registered for this account' })
  }
  if ((role === 'tenant' || role === 'client') && hasTenantHost && registryTenant?.tenantId && tenantId && registryTenant.tenantId !== tenantId) {
    throw createError({ statusCode: 403, message: 'This account does not belong to this tenant subdomain' })
  }
>>>>>>> Stashed changes
  return {
    ok: true,
    user: {
      uid: mongoUser.firebaseUid || '',
      email: mongoUser.email || '',
      role: mongoUser.role,
<<<<<<< Updated upstream
      ...(subdomain ? { subdomain } : {}),
=======
      tenantId: registryTenant?.tenantId ?? null,
      subdomain: registryTenant?.subdomain ?? null,
      firebaseTenantId: registryTenant?.firebaseTenantId ?? null,
>>>>>>> Stashed changes
      name: '',
      photoURL: '',
      emailVerified: true
    }
  }
})
