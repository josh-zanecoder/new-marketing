import { CloudTasksClient } from '@google-cloud/tasks'
import type { CampaignQueueJobData } from './emailQueue'
import { campaignBatchJobId, scheduledCampaignJobId } from './emailQueue'
import {
  getCampaignCloudTasksConfig,
  resolveCampaignCloudTasksAuth
} from '../config/campaignCloudTasks'
import { shouldSkipCampaignBatchEnqueue } from '../utils/campaignSend/campaignSendEnqueueGuard'
import { CAMPAIGN_SCHEDULE_TASK_PATH } from '../utils/campaignSend/constants'

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
    const resolved = resolveCampaignCloudTasksAuth()
    G.__campaignCloudTasksClient = Object.keys(resolved.auth).length
      ? new CloudTasksClient(resolved.auth)
      : new CloudTasksClient()
    G.__campaignCloudTasksQueuePath = G.__campaignCloudTasksClient.queuePath(
      cfg.projectId,
      cfg.location,
      cfg.queueName
    )
    logCt('client.init', {
      projectId: cfg.projectId,
      location: cfg.location,
      queueName: cfg.queueName,
      authMode: resolved.mode,
      principal: resolved.principal ?? '(Cloud Run / ADC service account)'
    })
  }

  if (!G.__campaignCloudTasksQueuePath) return null
  return { client: G.__campaignCloudTasksClient!, queuePath: G.__campaignCloudTasksQueuePath }
}

function scheduleWorkerUrl(): string {
  const cfg = getCampaignCloudTasksConfig()
  try {
    return `${new URL(cfg.workerUrl).origin}${CAMPAIGN_SCHEDULE_TASK_PATH}`
  } catch {
    return cfg.workerUrl.replace(
      /\/api\/internal\/campaign-sends\/batch\/?$/,
      CAMPAIGN_SCHEDULE_TASK_PATH
    )
  }
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

export function campaignScheduleTaskId(dbName: string, campaignId: string): string {
  const bullId = scheduledCampaignJobId(dbName, campaignId)
  return `cs-${bullId}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 500)
}

/** Match Cloud Task id to a campaign (optional sendRunId narrows to current run). */
export function campaignBatchCloudTaskMatchesCampaign(
  taskId: string,
  campaignId: string,
  dbName: string,
  sendRunId?: string
): boolean {
  if (!taskId.startsWith('cs-')) return false
  // Schedule tasks use cs-schedule|… — handled separately.
  if (taskId.startsWith('cs-schedule')) return false
  const dbSeg = dbName.replace(/[^a-zA-Z0-9_-]/g, '-')
  if (!taskId.includes(campaignId) || !taskId.includes(dbSeg)) return false
  if (sendRunId) {
    const runSeg = sendRunId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
    if (!taskId.includes(runSeg)) return false
  }
  return true
}

export function campaignScheduleCloudTaskMatchesCampaign(
  taskId: string,
  campaignId: string,
  dbName: string
): boolean {
  if (!taskId.startsWith('cs-schedule')) return false
  const dbSeg = dbName.replace(/[^a-zA-Z0-9_-]/g, '-')
  return taskId.includes(campaignId) && taskId.includes(dbSeg)
}

/** True when the Cloud Tasks queue still has batch tasks for this campaign. */
export async function hasCampaignBatchCloudTasks(
  campaignId: string,
  dbName: string,
  sendRunId?: string
): Promise<boolean> {
  const n = await countCampaignBatchCloudTasks(campaignId, dbName, sendRunId)
  return n > 0
}

export async function hasScheduledCampaignCloudTask(
  campaignId: string,
  dbName: string
): Promise<boolean> {
  const conn = getClient()
  if (!conn) return false
  const taskId = campaignScheduleTaskId(dbName, campaignId)
  const name = `${conn.queuePath}/tasks/${taskId}`
  try {
    await conn.client.getTask({ name })
    return true
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    if (code === 5) return false
    try {
      const tasksPrefix = `${conn.queuePath}/tasks/`
      const iterable = conn.client.listTasksAsync({ parent: conn.queuePath })
      for await (const task of iterable) {
        const tName = task.name || ''
        if (!tName.startsWith(tasksPrefix)) continue
        const id = tName.slice(tasksPrefix.length)
        if (campaignScheduleCloudTaskMatchesCampaign(id, campaignId, dbName)) return true
      }
    } catch {
      /* ignore */
    }
    return false
  }
}

export async function countCampaignBatchCloudTasks(
  campaignId: string,
  dbName: string,
  sendRunId?: string
): Promise<number> {
  const conn = getClient()
  if (!conn) return 0

  const tasksPrefix = `${conn.queuePath}/tasks/`
  let count = 0

  try {
    const iterable = conn.client.listTasksAsync({ parent: conn.queuePath })
    for await (const task of iterable) {
      const name = task.name || ''
      if (!name.startsWith(tasksPrefix)) continue
      const taskId = name.slice(tasksPrefix.length)
      if (campaignBatchCloudTaskMatchesCampaign(taskId, campaignId, dbName, sendRunId)) {
        count += 1
      }
    }
  } catch (e: unknown) {
    logCt('list.failed', {
      campaignId,
      dbName,
      error: e instanceof Error ? e.message : String(e)
    })
  }

  return count
}

export async function enqueueCampaignBatchCloudTask(
  data: CampaignQueueJobData
): Promise<{ taskId: string; duplicate?: boolean; skipped?: boolean }> {
  if (await shouldSkipCampaignBatchEnqueue(data)) {
    return { taskId: '', skipped: true }
  }

  const conn = getClient()
  const cfg = getCampaignCloudTasksConfig()
  if (!conn) {
    throw new Error('Campaign Cloud Tasks is not configured')
  }

  const { campaignId, dbName, sendRunId, page } = data
  const taskId = campaignBatchTaskId(dbName, campaignId, sendRunId, page)
  const taskName = `${conn.queuePath}/tasks/${taskId}`
  const taskBody = Buffer.from(JSON.stringify(data)).toString('base64')
  const delayMs = Math.max(0, Number(data.delayMs || 0))
  const scheduleTime =
    delayMs > 0 ? { seconds: Math.floor((Date.now() + delayMs) / 1000) } : undefined

  try {
    await conn.client.createTask({
      parent: conn.queuePath,
      task: {
        name: taskName,
        ...(scheduleTime ? { scheduleTime } : {}),
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
    const resolved = resolveCampaignCloudTasksAuth()
    logCt('enqueue.failed', {
      campaignId,
      dbName,
      taskId,
      error: msg,
      authMode: resolved.mode,
      principal: resolved.principal ?? '(Cloud Run / ADC service account)',
      hint:
        msg.includes('PERMISSION_DENIED') || msg.includes('cloudtasks.tasks.create')
          ? 'Grant roles/cloudtasks.enqueuer on the queue (or project) to the principal above. Do not use FIREBASE_CLIENT_EMAIL for Cloud Tasks.'
          : undefined
    })
    throw e
  }
}

/** Delayed Cloud Task that starts a Scheduled campaign (replaces BullMQ delay jobs). */
export async function enqueueScheduledCampaignCloudTask(params: {
  campaignId: string
  dbName: string
  delayMs: number
}): Promise<{ taskId: string; duplicate?: boolean }> {
  const conn = getClient()
  const cfg = getCampaignCloudTasksConfig()
  if (!conn) {
    throw new Error('Campaign Cloud Tasks is not configured')
  }

  const { campaignId, dbName } = params
  const delayMs = Math.max(0, Number(params.delayMs || 0))
  const taskId = campaignScheduleTaskId(dbName, campaignId)
  const taskName = `${conn.queuePath}/tasks/${taskId}`
  const body = {
    kind: 'startScheduled' as const,
    campaignId,
    dbName
  }
  const taskBody = Buffer.from(JSON.stringify(body)).toString('base64')
  const scheduleTime =
    delayMs > 0 ? { seconds: Math.floor((Date.now() + delayMs) / 1000) } : undefined

  try {
    await conn.client.createTask({
      parent: conn.queuePath,
      task: {
        name: taskName,
        ...(scheduleTime ? { scheduleTime } : {}),
        httpRequest: {
          httpMethod: 'POST',
          url: scheduleWorkerUrl(),
          headers: {
            'Content-Type': 'application/json',
            'X-Campaign-Send-Worker-Secret': cfg.workerSecret
          },
          body: taskBody
        }
      }
    })
    logCt('enqueue.schedule', {
      campaignId,
      dbName,
      taskId,
      delayMs,
      queue: cfg.queueName
    })
    return { taskId }
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    const msg = e instanceof Error ? e.message : String(e)
    if (code === 6 || msg.includes('ALREADY_EXISTS')) {
      logCt('enqueue.schedule.duplicate', { campaignId, dbName, taskId })
      return { taskId, duplicate: true }
    }
    logCt('enqueue.schedule.failed', { campaignId, dbName, taskId, error: msg })
    throw e
  }
}

export async function removeScheduledCampaignCloudTasks(
  campaignId: string,
  dbName: string
): Promise<number> {
  const conn = getClient()
  if (!conn) return 0

  let removed = 0
  const primaryId = campaignScheduleTaskId(dbName, campaignId)
  const primaryName = `${conn.queuePath}/tasks/${primaryId}`
  try {
    await conn.client.deleteTask({ name: primaryName })
    removed += 1
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code
    if (code !== 5) {
      logCt('delete.schedule.skip', {
        taskName: primaryName,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }

  try {
    const tasksPrefix = `${conn.queuePath}/tasks/`
    const iterable = conn.client.listTasksAsync({ parent: conn.queuePath })
    for await (const task of iterable) {
      const name = task.name || ''
      if (!name.startsWith(tasksPrefix)) continue
      const taskId = name.slice(tasksPrefix.length)
      if (!campaignScheduleCloudTaskMatchesCampaign(taskId, campaignId, dbName)) continue
      if (taskId === primaryId) continue
      try {
        await conn.client.deleteTask({ name: task.name })
        removed += 1
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore list failures */
  }

  if (removed > 0) {
    logCt('delete.schedule.summary', { campaignId, dbName, removed })
  }
  return removed
}

/** Best-effort delete queued batch tasks for a campaign (cancel / stop). */
export async function removeCampaignBatchCloudTasks(
  campaignId: string,
  dbName: string
): Promise<number> {
  const conn = getClient()
  if (!conn) return 0

  const tasksPrefix = `${conn.queuePath}/tasks/`
  let removed = 0

  try {
    const iterable = conn.client.listTasksAsync({ parent: conn.queuePath })
    for await (const task of iterable) {
      const name = task.name || ''
      if (!name.startsWith(tasksPrefix)) continue
      const taskId = name.slice(tasksPrefix.length)
      if (!campaignBatchCloudTaskMatchesCampaign(taskId, campaignId, dbName)) continue
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
