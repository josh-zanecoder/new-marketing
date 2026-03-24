import { getRegistryConnection } from '../../../../lib/mongoose'
import { ensureTenantDatabaseInitialized } from '../../../../tenant/provisioning'
import { isAdminAuthContext } from '../../../../tenant/registry-auth'
import { ensureTenantEventTopic } from '../../../../services/kafkaProducer'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ name?: string; email?: string; tenantId?: string; subdomain?: string }>(event)
  const displayName = body?.name?.trim()
  const contactEmail = body?.email?.trim().toLowerCase()
  const tenantId = body?.tenantId?.trim() || null
  const subdomain = body?.subdomain?.trim() ? body.subdomain : null

  if (!displayName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const registryConn = await getRegistryConnection()
  const { dbName, apiKey, tenantId: resolvedTenantId } =
    await ensureTenantDatabaseInitialized(
      registryConn,
      displayName,
      contactEmail || null,
      tenantId,
      subdomain
    )
  let kafkaTopic: string | null = null
  try {
    kafkaTopic = await ensureTenantEventTopic(displayName)
  } catch (err) {
    console.error('[Kafka] failed to ensure tenant topic:', err)
  }

  return {
    ok: true,
    dbName,
    tenantId: resolvedTenantId,
    apiKey: apiKey ?? undefined,
    kafkaTopic: kafkaTopic ?? undefined
  }
})
