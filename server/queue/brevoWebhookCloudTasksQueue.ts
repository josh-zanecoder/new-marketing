import { CloudTasksClient } from '@google-cloud/tasks'
import {
  getBrevoWebhookCloudTasksConfig
} from '../config/brevoWebhookCloudTasks'
import {
  resolveCampaignCloudTasksAuth
} from '../config/campaignCloudTasks'
import { BREVO_WEBHOOK_WORKER_SECRET_HEADER } from '../constants/brevoWebhookTask'
import { brevoWebhookCloudTaskId } from '../utils/brevo/brevoWebhookTaskId'
import type { ParsedBrevoTransactionalWebhook } from '../utils/tracking/parseBrevoTransactionalWebhookPayload'

const G = globalThis as typeof globalThis & {
  __brevoWebhookCloudTasksClient?: CloudTasksClient | null
  __brevoWebhookCloudTasksQueuePath?: string | null
}

function logBw(event: string, details: Record<string, unknown>) {
  console.log(`[BrevoWebhookCloudTasks] ${event}`, details)
}

function getClient(): { client: CloudTasksClient; queuePath: string } | null {
  const cfg = getBrevoWebhookCloudTasksConfig()
  if (!cfg.enabled) return null

  if (!G.__brevoWebhookCloudTasksClient) {
    const resolved = resolveCampaignCloudTasksAuth()
    G.__brevoWebhookCloudTasksClient = Object.keys(resolved.auth).length
      ? new CloudTasksClient(resolved.auth)
      : new CloudTasksClient()
    G.__brevoWebhookCloudTasksQueuePath = G.__brevoWebhookCloudTasksClient.queuePath(
      cfg.projectId,
      cfg.location,
      cfg.queueName
    )
    logBw('client.init', {
      projectId: cfg.projectId,
      location: cfg.location,
      queueName: cfg.queueName,
      workerUrl: cfg.workerUrl,
      authMode: resolved.mode,
      principal: resolved.principal ?? '(Cloud Run / ADC service account)'
    })
  }

  if (!G.__brevoWebhookCloudTasksQueuePath) return null
  return { client: G.__brevoWebhookCloudTasksClient!, queuePath: G.__brevoWebhookCloudTasksQueuePath }
}

export type BrevoWebhookQueuePayload = {
  kind: 'brevoTransactional'
  body: unknown
  messageId: string
  event: string
}

export async function enqueueBrevoWebhookCloudTask(
  parsed: ParsedBrevoTransactionalWebhook,
  body: unknown
): Promise<{ taskId: string; duplicate?: boolean }> {
  const conn = getClient()
  const cfg = getBrevoWebhookCloudTasksConfig()
  if (!conn) {
    throw new Error('Brevo webhook Cloud Tasks is not configured')
  }

  const taskId = brevoWebhookCloudTaskId(parsed)
  const taskName = `${conn.queuePath}/tasks/${taskId}`
  const payload: BrevoWebhookQueuePayload = {
    kind: 'brevoTransactional',
    body,
    messageId: parsed.messageId,
    event: parsed.event
  }
  const taskBody = Buffer.from(JSON.stringify(payload)).toString('base64')

  try {
    await conn.client.createTask({
      parent: conn.queuePath,
      task: {
        name: taskName,
        httpRequest: {
          httpMethod: 'POST',
          url: cfg.workerUrl,
          headers: {
            'Content-Type': 'application/json',
            [BREVO_WEBHOOK_WORKER_SECRET_HEADER]: cfg.workerSecret
          },
          body: taskBody
        }
      }
    })
    logBw('enqueue', {
      taskId,
      messageId: parsed.messageId,
      event: parsed.event,
      queue: cfg.queueName
    })
    return { taskId }
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    const msg = e instanceof Error ? e.message : String(e)
    if (code === 6 || msg.includes('ALREADY_EXISTS')) {
      logBw('enqueue.duplicate', { taskId, messageId: parsed.messageId, event: parsed.event })
      return { taskId, duplicate: true }
    }
    const resolved = resolveCampaignCloudTasksAuth()
    logBw('enqueue.failed', {
      taskId,
      messageId: parsed.messageId,
      event: parsed.event,
      error: msg,
      authMode: resolved.mode,
      principal: resolved.principal ?? '(Cloud Run / ADC service account)'
    })
    throw e
  }
}
