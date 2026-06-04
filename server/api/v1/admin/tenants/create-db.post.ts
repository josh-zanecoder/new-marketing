import { getRegistryConnection } from '@server/lib/mongoose'
import { ensureTenantDatabaseInitialized } from '@server/tenant/provisioning'
import { isAdminAuthContext } from '@server/tenant/registry-auth'
import {
  normalizeCampaignSenderEmailInput,
  normalizeCampaignSenderNameInput
} from '@server/utils/registry/tenantAdminRow'
import {
  computeDefaultMarketingOutboundTopicForTenant,
  ensureTenantEventTopic,
  invalidateTenantTopicCacheForDbName
} from '@server/kafka/kafkaProducer'
import { buildCrmExternalConnectionMetadata } from '@server/utils/admin/buildCrmExternalConnectionMetadata'

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
    defaultCampaignSenderEmail?: string | null
    defaultCampaignSenderName?: string | null
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

  const defaultCampaignSenderEmail =
    body?.defaultCampaignSenderEmail !== undefined
      ? normalizeCampaignSenderEmailInput(body.defaultCampaignSenderEmail)
      : null
  const defaultCampaignSenderName =
    body?.defaultCampaignSenderName !== undefined
      ? normalizeCampaignSenderNameInput(body.defaultCampaignSenderName)
      : null

  const registryConn = await getRegistryConnection()
  const { dbName, apiKey, tenantId: resolvedTenantId } =
    await ensureTenantDatabaseInitialized(
      registryConn,
      displayName,
      contactEmail || null,
      tenantId,
      { crmAppUrl }
    )

  const autoTopic = computeDefaultMarketingOutboundTopicForTenant(displayName, dbName)
  await registryConn.collection('clients').updateOne(
    { dbName },
    {
      $set: {
        kafkaOutboundTopic: autoTopic,
        defaultCampaignSenderEmail,
        defaultCampaignSenderName
      }
    }
  )
  invalidateTenantTopicCacheForDbName(dbName)
  let kafkaTopic: string | null = null
  try {
    kafkaTopic = await ensureTenantEventTopic(dbName)
  } catch (err) {
    console.error('[Kafka] failed to ensure tenant topic:', err)
  }

  const resolvedTopic = kafkaTopic ?? autoTopic
  const crmExternalConnection =
    apiKey && resolvedTenantId
      ? buildCrmExternalConnectionMetadata({
          dbName,
          tenantId: resolvedTenantId,
          apiKey,
          kafkaTopic: resolvedTopic
        })
      : undefined

  return {
    ok: true,
    dbName,
    tenantId: resolvedTenantId,
    apiKey: apiKey ?? undefined,
    kafkaTopic: resolvedTopic,
    crmExternalConnection
  }
})
