import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import { replayInboundKafkaRawMessage } from '@server/kafka/kafkaProducer'
import {
  ackMarketingSyncDlqEntry,
  getMarketingSyncDlqEntry
} from '@server/utils/marketingSyncHealth/store'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const id = decodeURIComponent(String(getRouterParam(event, 'id') || '')).trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'DLQ id is required' })
  }

  const entry = await getMarketingSyncDlqEntry(id)
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'DLQ entry not found' })
  }
  if (!entry.rawPreview?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'DLQ entry has no raw payload to replay'
    })
  }

  try {
    await replayInboundKafkaRawMessage(entry.rawPreview, entry.kafkaTopic)
  } catch (err) {
    throw createError({
      statusCode: 422,
      statusMessage: err instanceof Error ? err.message : 'Replay failed',
      data: {
        id,
        error: err instanceof Error ? err.message : String(err)
      }
    })
  }

  await ackMarketingSyncDlqEntry(id)

  return {
    ok: true,
    id,
    action: 'replay' as const,
    dbName: entry.dbName,
    eventType: entry.eventType
  }
})
