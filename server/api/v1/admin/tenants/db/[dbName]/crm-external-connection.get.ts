import { getRegistryConnection } from '@server/lib/mongoose'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { computeDefaultMarketingOutboundTopicForTenant } from '@server/kafka/kafkaProducer'
import { buildCrmExternalConnectionMetadata } from '@server/utils/admin/buildCrmExternalConnectionMetadata'

type RegistryClientRow = {
  dbName: string
  name?: string
  tenantId?: string | null
  kafkaOutboundTopic?: string | null
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const dbName = getRouterParam(event, 'dbName')?.trim()
  if (!dbName) {
    throw createError({ statusCode: 400, message: 'dbName is required' })
  }

  const registryConn = await getRegistryConnection()
  const doc = await registryConn.collection('clients').findOne({ dbName }) as RegistryClientRow | null
  if (!doc) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const tenantId = String(doc.tenantId ?? '').trim()
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant is missing tenantId in registry' })
  }

  const kafkaTopic =
    String(doc.kafkaOutboundTopic ?? '').trim() ||
    computeDefaultMarketingOutboundTopicForTenant(String(doc.name ?? ''), dbName)

  return {
    ok: true,
    crmExternalConnection: buildCrmExternalConnectionMetadata({
      dbName,
      tenantId,
      apiKey: '',
      kafkaTopic
    })
  }
})
