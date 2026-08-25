import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { isBrevoWebhookCloudTasksEnabled } from '@server/config/brevoWebhookCloudTasks'
import { verifyBrevoWebhookRequestAuth } from '@server/utils/brevo/brevoWebhookRequestAuth'
import { enqueueBrevoWebhookCloudTask } from '@server/queue/brevoWebhookCloudTasksQueue'
import { applyBrevoTrackingWebhook, resolveTenantDbName } from '@server/utils/tracking/applyBrevoTrackingWebhook'
import { parseBrevoTransactionalWebhookPayload } from '@server/utils/tracking/parseBrevoTransactionalWebhookPayload'

/**
 * Brevo transactional webhook → upsert into tenant `brevo_tracking_events`.
 *
 * Configure in Brevo → Transactional → Settings → Webhook:
 *   URL:  {MARKETING_PUBLIC_BASE_URL}/api/v1/webhooks/brevo/transactional
 *   Auth: Brevo UI “Token” (Authorization: Bearer …), or custom header
 *         `x-brevo-webhook-secret`, matching the tenant webhook secret / env.
 *
 * When Cloud Tasks is configured, validates and enqueues quickly so UI/login
 * is not blocked by slow Mongo upserts during webhook floods.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = parseBrevoTransactionalWebhookPayload(body)
  if (!parsed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Could not parse Brevo webhook payload'
    })
  }

  const dbName = await resolveTenantDbName(parsed)
  const auth = await verifyBrevoWebhookRequestAuth(event, dbName)
  if (!auth.ok) {
    throw createError({ statusCode: auth.statusCode, statusMessage: auth.message })
  }

  if (isBrevoWebhookCloudTasksEnabled()) {
    try {
      const queued = await enqueueBrevoWebhookCloudTask(parsed, body)
      setResponseStatus(event, 200)
      return {
        success: true,
        accepted: true,
        queued: true,
        taskId: queued.taskId,
        duplicate: Boolean(queued.duplicate),
        messageId: parsed.messageId,
        event: parsed.event
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[brevo-webhook] enqueue failed', {
        messageId: parsed.messageId,
        event: parsed.event,
        error: message
      })
      throw createError({
        statusCode: 503,
        statusMessage: 'Brevo webhook queue unavailable'
      })
    }
  }

  const result = await applyBrevoTrackingWebhook(body)
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      statusMessage: result.message
    })
  }

  setResponseStatus(event, 200)
  return {
    success: true,
    dbName: result.dbName,
    upserted: result.upserted,
    messageId: result.messageId,
    event: result.event
  }
})
