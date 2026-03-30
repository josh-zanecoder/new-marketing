import { getRegistryConnection } from '../../../../lib/mongoose'
import { ensureTenantDatabaseInitialized } from '../../../../tenant/provisioning'
import { isAdminAuthContext } from '../../../../tenant/registry-auth'
import { ensureTenantEventTopic } from '../../../../services/kafkaProducer'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{
    name?: string
    email?: string
    tenantId?: string
    crmAppUrl?: string | null
  }>(event)
  const displayName = body?.name?.trim()
  const contactEmail = body?.email?.trim().toLowerCase()
  const tenantId = body?.tenantId?.trim() || null

  if (!displayName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  let crmAppUrl: string | null = null
  const rawCrm = body?.crmAppUrl
  if (rawCrm !== undefined && rawCrm !== null && String(rawCrm).trim() !== '') {
    const u = String(rawCrm).trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(u)) {
      throw createError({
        statusCode: 400,
        message: 'CRM app URL must start with http:// or https://'
      })
    }
    crmAppUrl = u
  }

  const registryConn = await getRegistryConnection()
  const { dbName, apiKey, tenantId: resolvedTenantId } =
    await ensureTenantDatabaseInitialized(
      registryConn,
      displayName,
      contactEmail || null,
      tenantId,
      { crmAppUrl }
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
