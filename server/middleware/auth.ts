import { verifyFirebaseIdToken } from '../services/firebase.service'
import User from '../models/admin/User'
import type { Model } from 'mongoose'
import type { H3Event } from 'h3'
import type { IUser } from '../types/admin/user.model'
import { getRegistryConnection } from '../lib/mongoose'
import {
  findRegistryTenantByApiKey,
  findRegistryTenantByDbName,
  findRegistryTenantByTenantId
} from '../tenant/registry-auth'
import { MARKETING_TENANT_SESSION_COOKIE } from '../constants/tenantAuth.constants'
import { MAX_CONTACT_OWNER_EMAILS_IN_SESSION } from '../constants/contactOwnerScope.constants'
import { verifyMarketingTenantBrowserSession } from '../utils/auth/marketingTenantBrowserSession'

const PUBLIC_API_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/sso',
  '/api/v1/auth/logout',
  '/api/v1/auth/tenant-handoff'
]

const ADMIN_API_PREFIX = '/api/v1/admin'

const TENANT_FORWARDED_USER_ID_MAX = 128
const TENANT_FORWARDED_USER_EMAIL_MAX = 320
const TENANT_FORWARDED_USER_NAME_MAX = 200
const TENANT_FORWARDED_USER_PART_MAX = 100
const TENANT_FORWARDED_USER_PHONE_MAX = 40
const TENANT_FORWARDED_USER_ROLE_MAX = 120

function firstHeader(event: H3Event, names: string[]): string {
  for (const name of names) {
    const v = (getHeader(event, name) || '').trim()
    if (v) return v
  }
  return ''
}

/** Optional forwarded tenant operator; only when API key auth succeeds (same trust as the key). */
function tenantForwardedUserFromHeaders(event: H3Event): {
  tenantUserId?: string
  tenantUserEmail?: string
  tenantUserName?: string
  tenantUserFirstName?: string
  tenantUserLastName?: string
  tenantUserPhone?: string
  tenantUserRole?: string
} {
  const id = firstHeader(event, ['x-tenant-user-id', 'x-crm-user-id'])
  const email = firstHeader(event, ['x-tenant-user-email', 'x-crm-user-email']).toLowerCase()
  const name = firstHeader(event, ['x-tenant-user-name', 'x-crm-user-name'])
  const firstName = firstHeader(event, ['x-tenant-user-first-name', 'x-crm-user-first-name'])
  const lastName = firstHeader(event, ['x-tenant-user-last-name', 'x-crm-user-last-name'])
  const phone = firstHeader(event, ['x-tenant-user-phone', 'x-crm-user-phone'])
  const role = firstHeader(event, ['x-tenant-user-role', 'x-crm-user-role'])
  const out: {
    tenantUserId?: string
    tenantUserEmail?: string
    tenantUserName?: string
    tenantUserFirstName?: string
    tenantUserLastName?: string
    tenantUserPhone?: string
    tenantUserRole?: string
  } = {}
  if (id.length > 0 && id.length <= TENANT_FORWARDED_USER_ID_MAX) out.tenantUserId = id
  if (email.length > 0 && email.length <= TENANT_FORWARDED_USER_EMAIL_MAX) out.tenantUserEmail = email
  if (name.length > 0 && name.length <= TENANT_FORWARDED_USER_NAME_MAX) out.tenantUserName = name
  if (firstName.length > 0 && firstName.length <= TENANT_FORWARDED_USER_PART_MAX)
    out.tenantUserFirstName = firstName
  if (lastName.length > 0 && lastName.length <= TENANT_FORWARDED_USER_PART_MAX)
    out.tenantUserLastName = lastName
  if (phone.length > 0 && phone.length <= TENANT_FORWARDED_USER_PHONE_MAX) out.tenantUserPhone = phone
  if (role.length > 0 && role.length <= TENANT_FORWARDED_USER_ROLE_MAX) out.tenantUserRole = role
  return out
}

/** Only for API-key requests from the tenant app / BFF. */
function tenantContactOwnerEmailsHeader(event: H3Event): string[] | undefined {
  const raw = firstHeader(event, [
    'x-tenant-contact-owner-emails',
    'x-crm-contact-owner-emails'
  ])
  if (!raw) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(',')) {
    const e = part.trim().toLowerCase()
    if (!e || seen.has(e)) continue
    seen.add(e)
    out.push(e)
    if (out.length >= MAX_CONTACT_OWNER_EMAILS_IN_SESSION) break
  }
  return out.length > 0 ? out : undefined
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

  const registryConn = await getRegistryConnection()

  const sessionCookie = getCookie(event, MARKETING_TENANT_SESSION_COOKIE)?.trim() || ''
  if (sessionCookie && !path.startsWith(ADMIN_API_PREFIX)) {
    try {
      const parts = sessionCookie.split('.')
      if (parts.length === 3 && parts[1]) {
        const pb64 = parts[1]
        const pad = '='.repeat((4 - (pb64.length % 4)) % 4)
        const pJson = JSON.parse(
          Buffer.from(pb64.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString(
            'utf8'
          )
        ) as { sub?: string }
        const dbName =
          typeof pJson.sub === 'string' ? pJson.sub.trim() : ''
        if (dbName) {
          const row = await findRegistryTenantByDbName(registryConn, dbName)
          if (row?.clientKeyHash) {
            const {
              tenantId: tidFromJwt,
              tenantUserEmail,
              tenantUserFirstName,
              tenantUserLastName,
              tenantUserPhone,
              tenantUserRole,
              contactOwnerEmails,
              tenantWideContacts
            } = verifyMarketingTenantBrowserSession(sessionCookie, row.clientKeyHash, dbName)
            const tidMismatch = Boolean(
              row.tenantId && tidFromJwt && row.tenantId !== tidFromJwt
            )
            if (!tidMismatch) {
              event.context.auth = {
                type: 'tenantApiKey',
                role: 'tenant',
                tenantName: row.tenantName,
                dbName: row.dbName,
                ...(row.tenantId ? { tenantId: row.tenantId } : {}),
                ...(row.crmAppUrl ? { crmAppUrl: row.crmAppUrl } : {}),
                ...(tenantUserEmail ? { tenantUserEmail } : {}),
                ...(tenantUserFirstName ? { tenantUserFirstName } : {}),
                ...(tenantUserLastName ? { tenantUserLastName } : {}),
                ...(tenantUserPhone ? { tenantUserPhone } : {}),
                ...(tenantUserRole ? { tenantUserRole } : {}),
                ...(tenantWideContacts === true ? { tenantWideContacts: true } : {}),
                ...(!tenantWideContacts && contactOwnerEmails?.length
                  ? { contactOwnerScope: contactOwnerEmails }
                  : {})
              }
              return
            }
          }
        }
      }
    } catch {
      /* invalid or expired session */
    }
  }

  const apiKey = getTenantApiKeyFromEvent(event)

  if (apiKey && !path.startsWith(ADMIN_API_PREFIX)) {
    const row = await findRegistryTenantByApiKey(registryConn, apiKey)
    if (row) {
      const forwarded = tenantForwardedUserFromHeaders(event)
      const headerOwners = tenantContactOwnerEmailsHeader(event)
      event.context.auth = {
        type: 'tenantApiKey',
        role: 'tenant',
        tenantName: row.tenantName,
        dbName: row.dbName,
        ...(row.tenantId ? { tenantId: row.tenantId } : {}),
        ...(row.crmAppUrl ? { crmAppUrl: row.crmAppUrl } : {}),
        ...(forwarded.tenantUserId ? { tenantUserId: forwarded.tenantUserId } : {}),
        ...(forwarded.tenantUserEmail ? { tenantUserEmail: forwarded.tenantUserEmail } : {}),
        ...(forwarded.tenantUserName ? { tenantUserName: forwarded.tenantUserName } : {}),
        ...(forwarded.tenantUserFirstName
          ? { tenantUserFirstName: forwarded.tenantUserFirstName }
          : {}),
        ...(forwarded.tenantUserLastName ? { tenantUserLastName: forwarded.tenantUserLastName } : {}),
        ...(forwarded.tenantUserPhone ? { tenantUserPhone: forwarded.tenantUserPhone } : {}),
        ...(forwarded.tenantUserRole ? { tenantUserRole: forwarded.tenantUserRole } : {}),
        ...(headerOwners?.length ? { contactOwnerScope: headerOwners } : {})
      }
      return
    }
  }

  const idToken = getCookie(event, 'marketing_token') || getBearerToken(event)
  if (!idToken) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const decoded = await verifyFirebaseIdToken(idToken)
  if (!decoded) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const UserModel = User as unknown as Model<IUser>
  const dbUser = await UserModel.findOne({ firebaseUid: decoded.uid }).lean()
  if (!dbUser) {
    throw createError({ statusCode: 403, message: 'User not found in app database' })
  }

  if (isTenantUserRole(dbUser.role)) {
    const tenantId =
      typeof dbUser.tenantId === 'string' ? dbUser.tenantId.trim() : ''
    if (!tenantId) {
      throw createError({
        statusCode: 403,
        message: 'Tenant account is missing tenantId'
      })
    }
    const row = await findRegistryTenantByTenantId(registryConn, tenantId)
    if (!row) {
      throw createError({
        statusCode: 403,
        message: 'No tenant registered for this tenantId'
      })
    }
    event.context.auth = {
      uid: decoded.uid,
      email: decoded.email || '',
      role: 'tenant',
      tenantId: row.tenantId,
      dbName: row.dbName
    }
    return
  }

  event.context.auth = {
    uid: decoded.uid,
    email: decoded.email || '',
    role: dbUser.role
  }
})
