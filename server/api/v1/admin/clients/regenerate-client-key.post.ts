import { getRegistryConnection } from '../../../../utils/db'
import {
  generateClientKey,
  hashClientKey,
  getClientKeyPrefix
} from '../../../../utils/clientKey'
import { isAdminAuthContext } from '../../../../utils/roles'

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
    throw createError({ statusCode: 404, message: 'Client not found' })
  }

  const clientKey = generateClientKey()
  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        clientKeyHash: hashClientKey(clientKey),
        clientKeyPrefix: getClientKeyPrefix(clientKey)
      }
    }
  )

  return {
    ok: true,
    clientKey
  }
})
