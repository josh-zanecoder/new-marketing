import { CloudTasksClient } from '@google-cloud/tasks'
import type { CampaignQueueJobData } from './emailQueue'
import { campaignBatchJobId } from './emailQueue'
import {
  getCampaignCloudTasksClientAuth,
  getCampaignCloudTasksConfig
} from '../config/campaignCloudTasks'

const G = globalThis as typeof globalThis & {
  __campaignCloudTasksClient?: CloudTasksClient | null
  __campaignCloudTasksQueuePath?: string | null
}

function logCt(event: string, details: Record<string, unknown>) {
  console.log(`[CampaignCloudTasks] ${event}`, details)
}

function getClient(): { client: CloudTasksClient; queuePath: string } | null {
  const cfg = getCampaignCloudTasksConfig()
  if (!cfg.enabled) return null

  if (!G.__campaignCloudTasksClient) {
    const auth = getCampaignCloudTasksClientAuth()
    G.__campaignCloudTasksClient = Object.keys(auth).length
      ? new CloudTasksClient(auth)
      : new CloudTasksClient()
    G.__campaignCloudTasksQueuePath = G.__campaignCloudTasksClient.queuePath(
      cfg.projectId,
      cfg.location,
      cfg.queueName
    )
  }

  if (!G.__campaignCloudTasksQueuePath) return null
  return { client: G.__campaignCloudTasksClient!, queuePath: G.__campaignCloudTasksQueuePath }
}

export function campaignBatchTaskId(
  dbName: string,
  campaignId: string,
  sendRunId: string,
  page: number
): string {
  const bullId = campaignBatchJobId(dbName, campaignId, sendRunId, page)
  return `cs-${bullId}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 500)
}

export async function enqueueCampaignBatchCloudTask(
  data: CampaignQueueJobData
): Promise<{ taskId: string; duplicate?: boolean }> {
  const conn = getClient()
  const cfg = getCampaignCloudTasksConfig()
  if (!conn) {
    throw new Error('Campaign Cloud Tasks is not configured')
  }

  const { campaignId, dbName, sendRunId, page } = data
  const taskId = campaignBatchTaskId(dbName, campaignId, sendRunId, page)
  const taskName = `${conn.queuePath}/tasks/${taskId}`
  const taskBody = Buffer.from(JSON.stringify(data)).toString('base64')

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
            'X-Campaign-Send-Worker-Secret': cfg.workerSecret
          },
          body: taskBody
        }
      }
    })
    logCt('enqueue', { campaignId, dbName, sendRunId, page, taskId, queue: cfg.queueName })
    return { taskId }
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    const msg = e instanceof Error ? e.message : String(e)
    if (code === 6 || msg.includes('ALREADY_EXISTS')) {
      logCt('enqueue.duplicate', { campaignId, dbName, sendRunId, page, taskId })
      return { taskId, duplicate: true }
    }
    logCt('enqueue.failed', { campaignId, dbName, taskId, error: msg })
    throw e
  }
}

/** Best-effort delete queued batch tasks for a campaign (cancel / stop). */
export async function removeCampaignBatchCloudTasks(
  campaignId: string,
  dbName: string
): Promise<number> {
  const conn = getClient()
  if (!conn) return 0

  const tasksPrefix = `${conn.queuePath}/tasks/`
  const dbSeg = dbName.replace(/[^a-zA-Z0-9_-]/g, '-')
  let removed = 0

  try {
    const iterable = conn.client.listTasksAsync({ parent: conn.queuePath })
    for await (const task of iterable) {
      const name = task.name || ''
      if (!name.startsWith(tasksPrefix)) continue
      const taskId = name.slice(tasksPrefix.length)
      if (!taskId.startsWith('cs-')) continue
      if (!taskId.includes(campaignId) || !taskId.includes(dbSeg)) continue
      try {
        await conn.client.deleteTask({ name: task.name })
        removed += 1
      } catch (delErr: unknown) {
        const code = (delErr as { code?: number })?.code
        if (code !== 5) {
          logCt('delete.skip', {
            taskName: task.name,
            error: delErr instanceof Error ? delErr.message : String(delErr)
          })
        }
      }
    }
  } catch (e: unknown) {
    logCt('delete.failed', {
      campaignId,
      dbName,
      error: e instanceof Error ? e.message : String(e)
    })
  }

  if (removed > 0) {
    logCt('delete.summary', { campaignId, dbName, removed })
  }
  return removed
}

/** Local dev fallback when Cloud Tasks env is incomplete. */
export async function enqueueCampaignBatchLocally(data: CampaignQueueJobData): Promise<void> {
  const cfg = getCampaignCloudTasksConfig()
  const url = cfg.workerUrl
  const secret = cfg.workerSecret
  if (!url || !secret) {
    throw new Error('Campaign send worker URL/secret required for local fallback')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Campaign-Send-Worker-Secret': secret
    },
    body: JSON.stringify(data)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Local campaign batch worker failed (${res.status}): ${text}`)
  }
}
