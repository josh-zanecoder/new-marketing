import { verifyFirebaseIdToken } from '../services/firebase.service'
import User from '../models/User'
import type { Model } from 'mongoose'
import type { H3Event } from 'h3'
import type { IUser } from '../types/user.model'
import { getRegistryConnection } from '../utils/db'
import { findClientByClientKey } from '../utils/roles'

const PUBLIC_API_PREFIXES = ['/api/v1/auth/login', '/api/v1/auth/sso']

const ADMIN_API_PREFIX = '/api/v1/admin'

function getBearerToken(event: H3Event): string {
  const authorization = getHeader(event, 'authorization') || ''
  if (!authorization.startsWith('Bearer ')) return ''
  return authorization.slice(7).trim()
}

function getClientKey(event: H3Event): string {
  const header = getHeader(event, 'x-client-key') || getHeader(event, 'x-api-key') || ''
  if (header) return header.trim()
  const bearer = getBearerToken(event)
  if (bearer.startsWith('nmk_')) return bearer
  return ''
}

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/')) return
  if (PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  const clientKey = getClientKey(event)
  const registryConn = await getRegistryConnection()

  if (clientKey && !path.startsWith(ADMIN_API_PREFIX)) {
    const client = await findClientByClientKey(registryConn, clientKey)
    if (client) {
      event.context.auth = {
        type: 'clientKey',
        role: 'client',
        clientName: client.clientName,
        dbName: client.dbName
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

  event.context.auth = {
    uid: decoded.uid,
    email: decoded.email || '',
    role: dbUser.role
  }
})
