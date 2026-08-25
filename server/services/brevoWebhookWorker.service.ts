import { createError } from 'h3'
import { applyBrevoTrackingWebhook } from '@server/utils/tracking/applyBrevoTrackingWebhook'
import type { BrevoWebhookQueuePayload } from '../queue/brevoWebhookCloudTasksQueue'

export type BrevoWebhookWorkerResult =
  | { ok: true; dbName: string; upserted: boolean; messageId: string; event: string }
  | { ok: true; skipped: true; reason: string; messageId?: string; event?: string }
  | { ok: true; terminalFailure: true; reason: string; messageId?: string; event?: string }

function workerLog(event: string, details: Record<string, unknown>) {
  console.log(`[BrevoWebhookWorker] ${event}`, details)
}

export async function processBrevoWebhookWorkerTask(
  data: BrevoWebhookQueuePayload
): Promise<BrevoWebhookWorkerResult> {
  workerLog('task.received', {
    messageId: data.messageId,
    event: data.event
  })

  try {
    const result = await applyBrevoTrackingWebhook(data.body)
    if (!result.ok) {
      workerLog('task.applyFailed', {
        messageId: data.messageId,
        event: data.event,
        statusCode: result.statusCode,
        message: result.message
      })
      if (result.statusCode >= 500) {
        return {
          ok: true,
          terminalFailure: true,
          reason: result.message,
          messageId: data.messageId,
          event: data.event
        }
      }
      return {
        ok: true,
        skipped: true,
        reason: result.message,
        messageId: data.messageId,
        event: data.event
      }
    }

    workerLog('task.applied', {
      messageId: result.messageId,
      event: result.event,
      dbName: result.dbName,
      upserted: result.upserted
    })
    return {
      ok: true,
      dbName: result.dbName,
      upserted: result.upserted,
      messageId: result.messageId,
      event: result.event
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    workerLog('task.error', {
      messageId: data.messageId,
      event: data.event,
      error: message
    })
    return {
      ok: true,
      terminalFailure: true,
      reason: message,
      messageId: data.messageId,
      event: data.event
    }
  }
}

export function parseBrevoWebhookWorkerBody(raw: unknown): BrevoWebhookQueuePayload {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, message: 'Invalid Brevo webhook task payload' })
  }
  const body = raw as Partial<BrevoWebhookQueuePayload>
  if (body.kind !== 'brevoTransactional') {
    throw createError({ statusCode: 400, message: 'Invalid Brevo webhook task kind' })
  }
  const messageId = String(body.messageId || '').trim()
  const event = String(body.event || '').trim()
  if (!messageId || !event) {
    throw createError({ statusCode: 400, message: 'messageId and event are required' })
  }
  return {
    kind: 'brevoTransactional',
    body: body.body,
    messageId,
    event
  }
}
