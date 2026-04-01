import { getRegistryConnection } from '@server/lib/mongoose'
import {
  generateTenantApiKey,
  hashTenantApiKey,
  getTenantApiKeyPrefix
} from '@server/tenant/api-key'
import { isAdminAuthContext } from '@server/tenant/registry-auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ dbName?: string }>(event)
  const dbName = body?.dbName?.trim()

  if (!dbName) {
    throw createError({ statusCode: 400, message: 'dbName is required' })
  }

  const registryConn = await getRegistryConnection()
  const doc = await registryConn
    .collection('clients')
    .findOne({ dbName })
    .then((d) => d as { _id?: unknown } | null)

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const apiKey = generateTenantApiKey()
  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        clientKeyHash: hashTenantApiKey(apiKey),
        clientKeyPrefix: getTenantApiKeyPrefix(apiKey)
      }
    }
  )

  return {
    ok: true,
    apiKey
  }
})
