import { verifyFirebaseIdToken } from '../services/firebase.service'
import User from '../models/admin/User'
import type { Model } from 'mongoose'
import type { H3Event } from 'h3'
import type { IUser } from '../types/admin/user.model'
import { getRegistryConnection } from '../lib/mongoose'
import {
  findRegistryTenantByApiKey,
  findRegistryTenantBySubdomain,
  findRegistryTenantByTenantId
} from '../tenant/registry-auth'
import {
  extractSubdomainFromHost,
  getHostFromEvent,
  isAdminSubdomain,
  isTenantSubdomain
} from '../utils/tenant-host'

const PUBLIC_API_PREFIXES = ['/api/v1/auth/login', '/api/v1/auth/sso']

const ADMIN_API_PREFIX = '/api/v1/admin'

function isLocalHostRequest(event: H3Event): boolean {
  const host = (getHeader(event, 'host') || '').toLowerCase()
  return host.includes('localhost') || host.includes('127.0.0.1')
}

function getBearerToken(event: H3Event): string {
  const authorization = getHeader(event, 'authorization') || ''
  if (!authorization.startsWith('Bearer ')) return ''
  return authorization.slice(7).trim()
}

/** Reads tenant API key from headers or `nmk_` Bearer token. */
function getTenantApiKeyFromEvent(event: H3Event): string {
  const header = getHeader(event, 'x-client-key') || getHeader(event, 'x-api-key') || ''
  if (header) return header.trim()
  const bearer = getBearerToken(event)
  if (bearer.startsWith('nmk_')) return bearer
  return ''
}

function isTenantUserRole(role: string): boolean {
  return role === 'tenant' || role === 'client'
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  const apiKey = getTenantApiKeyFromEvent(event)
  const registryConn = await getRegistryConnection()
  const host = getHostFromEvent(event)
  const hostSubdomain = extractSubdomainFromHost(host)
  const hasTenantHost = isTenantSubdomain(hostSubdomain)
  const isAdminHost = !hostSubdomain || isAdminSubdomain(hostSubdomain)

  if (apiKey && !path.startsWith(ADMIN_API_PREFIX)) {
    const row = await findRegistryTenantByApiKey(registryConn, apiKey)
    if (row) {
<<<<<<< Updated upstream
      const tenantFromSub = event.context.tenantFromSubdomain
      if (!isLocalHostRequest(event) && (!tenantFromSub || tenantFromSub.dbName !== row.dbName)) {
        throw createError({
          statusCode: 403,
          message: 'Tenant subdomain does not match API key tenant'
        })
=======
      if (hasTenantHost && row.subdomain && row.subdomain !== hostSubdomain) {
        throw createError({ statusCode: 403, message: 'Tenant host does not match API key tenant' })
>>>>>>> Stashed changes
      }
      event.context.auth = {
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: row.tenantName,
        dbName: row.dbName,
        ...(row.tenantId ? { tenantId: row.tenantId } : {}),
        ...(row.subdomain ? { subdomain: row.subdomain } : {})
      }
      return
    }
  }

  const idToken = getCookie(event, 'marketing_token') || getBearerToken(event)
  if (!idToken) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const decoded = await verifyFirebaseIdToken(idToken).catch(() => null)
  if (!decoded) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const UserModel = User as unknown as Model<IUser>
  const dbUser = await UserModel.findOne({ firebaseUid: decoded.uid }).lean()
  if (!dbUser) {
    throw createError({ statusCode: 403, message: 'User not found in app database' })
  }

  if (isTenantUserRole(dbUser.role)) {
<<<<<<< Updated upstream
    const tenantId =
      typeof dbUser.tenantId === 'string' ? dbUser.tenantId.trim() : ''
    if (!tenantId) {
      throw createError({
        statusCode: 403,
        message: 'Tenant account is missing tenantId'
      })
    }
    if (!path.startsWith(ADMIN_API_PREFIX) && !isLocalHostRequest(event)) {
      const tenantFromSub = event.context.tenantFromSubdomain
      if (!tenantFromSub) {
        throw createError({
          statusCode: 400,
          message: 'Tenant subdomain required. Access tenant routes from your tenant subdomain.'
        })
      }
      if (tenantFromSub.tenantId !== tenantId) {
        throw createError({
          statusCode: 403,
          message: 'Tenant subdomain does not match your account'
        })
      }
    }
    const row = await findRegistryTenantByTenantId(registryConn, tenantId)
=======
    const tenantId = typeof dbUser.tenantId === 'string' ? dbUser.tenantId.trim() : ''
    const row = hasTenantHost ? await findRegistryTenantBySubdomain(registryConn, hostSubdomain) : await findRegistryTenantByTenantId(registryConn, tenantId)
>>>>>>> Stashed changes
    if (!row) {
      throw createError({
        statusCode: 403,
        message: hasTenantHost ? 'No tenant registered for this subdomain' : 'No tenant registered for this tenantId'
      })
    }
    if (!row.tenantId) throw createError({ statusCode: 403, message: 'Tenant account is missing tenantId' })
    if (!hasTenantHost && isAdminHost && tenantId && row.tenantId !== tenantId) {
      throw createError({ statusCode: 403, message: 'Tenant account does not match registry tenant' })
    }
    event.context.auth = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: 'tenant',
      tenantId: row.tenantId,
      dbName: row.dbName,
      ...(row.subdomain ? { subdomain: row.subdomain } : {})
    }
    return
  }

  event.context.auth = {
    uid: decoded.uid,
    email: decoded.email || '',
    role: dbUser.role
  }
})
