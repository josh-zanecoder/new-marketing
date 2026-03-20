import { getRegistryConnection } from '../../../../utils/db'
import { isAdminAuthContext } from '../../../../utils/roles'
import type { ClientResponse, RegistryClientDoc } from './clientTypes'

function toClientResponse(doc: RegistryClientDoc): ClientResponse | null {
  const name = typeof doc.name === 'string' ? doc.name : ''
  const email = typeof doc.email === 'string' ? doc.email : null
  const dbName = typeof doc.dbName === 'string' ? doc.dbName : ''
  const clientKeyPrefix =
    typeof doc.clientKeyPrefix === 'string' && doc.clientKeyPrefix
      ? doc.clientKeyPrefix
      : typeof doc.apiKeyPrefix === 'string' && doc.apiKeyPrefix
        ? doc.apiKeyPrefix
        : null
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : typeof doc.createdAt === 'string'
        ? new Date(doc.createdAt).toISOString()
        : null

  if (!name || !dbName || !createdAt) return null
  return { name, email, dbName, clientKeyPrefix, createdAt }
}

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

  const clients: ClientResponse[] = rawDocs
    .map((d) => toClientResponse(d as RegistryClientDoc))
    .filter((c): c is ClientResponse => !!c)

  return { clients }
})

