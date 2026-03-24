import { getRegistryConnection } from '../../../../lib/mongoose'
import { ensureTenantDatabaseInitialized } from '../../../../tenant/provisioning'
import { isAdminAuthContext } from '../../../../tenant/registry-auth'
import { ensureTenantEventTopic } from '../../../../services/kafkaProducer'
import { createFirebaseIdentityTenant } from '../../../../services/firebase-tenant.service'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody<{ name?: string; email?: string; tenantId?: string; subdomain?: string }>(event)
  const displayName = body?.name?.trim()
  const contactEmail = body?.email?.trim().toLowerCase()
  const tenantId = body?.tenantId?.trim() || null
<<<<<<< Updated upstream
  const subdomain = body?.subdomain?.trim() ? body.subdomain : null
=======
  const subdomain = body?.subdomain?.trim() || null
>>>>>>> Stashed changes

  if (!displayName) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  const registryConn = await getRegistryConnection()
  const { dbName, apiKey, tenantId: resolvedTenantId, subdomain: resolvedSubdomain } =
    await ensureTenantDatabaseInitialized(
      registryConn,
      displayName,
      contactEmail || null,
      tenantId,
      subdomain
    )
  let kafkaTopic: string | null = null
  let firebaseTenantId: string | null = null
  const clientDoc = await registryConn
    .collection('clients')
    .findOne({ dbName })
    .then((d) => d as { firebaseTenantId?: string } | null)
  firebaseTenantId =
    typeof clientDoc?.firebaseTenantId === 'string' && clientDoc.firebaseTenantId
      ? clientDoc.firebaseTenantId
      : null
  if (!firebaseTenantId) {
    firebaseTenantId = await createFirebaseIdentityTenant(displayName)
    if (firebaseTenantId) {
      await registryConn.collection('clients').updateOne(
        { dbName },
        { $set: { firebaseTenantId } }
      )
    }
  }
  try {
    kafkaTopic = await ensureTenantEventTopic(displayName)
  } catch (err) {
    console.error('[Kafka] failed to ensure tenant topic:', err)
  }

  return {
    ok: true,
    dbName,
    tenantId: resolvedTenantId,
    subdomain: resolvedSubdomain,
    firebaseTenantId: firebaseTenantId ?? undefined,
    apiKey: apiKey ?? undefined,
    kafkaTopic: kafkaTopic ?? undefined
  }
})
