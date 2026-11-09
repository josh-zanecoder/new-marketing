import { CloudTasksClient } from '@google-cloud/tasks'
import type { CampaignQueueJobData } from './emailQueue'
import { campaignBatchJobId } from './emailQueue'
import {
  getCampaignCloudTasksConfig,
  resolveCampaignCloudTasksAuth
} from '../config/campaignCloudTasks'
import { shouldSkipCampaignBatchEnqueue } from '../utils/campaignSend/campaignSendEnqueueGuard'
import { CAMPAIGN_SCHEDULE_TASK_PATH } from '../utils/campaignSend/constants'
import {
  campaignScheduleCloudTaskMatchesCampaign,
  legacyCampaignScheduleCloudTaskId,
  newCampaignScheduleCloudTaskId
} from '../utils/campaignSend/campaignScheduleCloudTaskId'

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

/** @deprecated Prefer {@link newCampaignScheduleCloudTaskId}; kept for legacy deletes. */
export function campaignScheduleTaskId(dbName: string, campaignId: string): string {
  return legacyCampaignScheduleCloudTaskId(dbName, campaignId)
}

export { campaignScheduleCloudTaskMatchesCampaign, newCampaignScheduleCloudTaskId }

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
  // Prefer list match — schedule tasks use unique suffixes after cancel/reschedule fix.
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
    /* fall through to legacy deterministic id */
  }
  const legacyId = legacyCampaignScheduleCloudTaskId(dbName, campaignId)
  const name = `${conn.queuePath}/tasks/${legacyId}`
  try {
    await conn.client.getTask({ name })
    return true
  } catch {
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
          ? 'Grant roles/cloudtasks.admin (or create+delete+list) on the queue/project to the Cloud Run SA. Do not use FIREBASE_CLIENT_EMAIL for Cloud Tasks.'
          : undefined
    })
    throw e
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  const msg = err instanceof Error ? err.message : String(err)
  return code === 6 || msg.includes('ALREADY_EXISTS')
}

function isNotFoundError(err: unknown): boolean {
  const code = (err as { code?: number })?.code
  const msg = err instanceof Error ? err.message : String(err)
  return code === 5 || msg.includes('NOT_FOUND')
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
  const body = {
    kind: 'startScheduled' as const,
    campaignId,
    dbName
  }
  const taskBody = Buffer.from(JSON.stringify(body)).toString('base64')
  const scheduleTime =
    delayMs > 0 ? { seconds: Math.floor((Date.now() + delayMs) / 1000) } : undefined

  const createWithId = async (taskId: string) => {
    const taskName = `${conn.queuePath}/tasks/${taskId}`
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
  }

  // Unique id per enqueue — Cloud Tasks tombstones deleted names for hours, so a
  // fixed cs-schedule-{db}-{campaignId} cannot be reused after cancel.
  let taskId = newCampaignScheduleCloudTaskId(dbName, campaignId)
  try {
    await createWithId(taskId)
    logCt('enqueue.schedule', {
      campaignId,
      dbName,
      taskId,
      delayMs,
      queue: cfg.queueName
    })
    return { taskId }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!isAlreadyExistsError(e)) {
      logCt('enqueue.schedule.failed', { campaignId, dbName, taskId, error: msg })
      throw e
    }

    // Extremely unlikely with UUID suffix; mint another id instead of fighting tombstones.
    logCt('enqueue.schedule.duplicate', { campaignId, dbName, taskId })
    taskId = newCampaignScheduleCloudTaskId(dbName, campaignId)
    try {
      await createWithId(taskId)
      logCt('enqueue.schedule.retried', {
        campaignId,
        dbName,
        taskId,
        delayMs,
        queue: cfg.queueName
      })
      return { taskId }
    } catch (retryErr: unknown) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
      logCt('enqueue.schedule.retry.failed', {
        campaignId,
        dbName,
        taskId,
        error: retryMsg
      })
      throw new Error(
        `Cannot schedule campaign: failed to create Cloud Tasks job (${retryMsg})`,
        { cause: retryErr }
      )
    }
  }
}

export async function removeScheduledCampaignCloudTasks(
  campaignId: string,
  dbName: string
): Promise<number> {
  const conn = getClient()
  if (!conn) return 0

  let removed = 0
  const legacyId = legacyCampaignScheduleCloudTaskId(dbName, campaignId)
  const legacyName = `${conn.queuePath}/tasks/${legacyId}`
  try {
    await conn.client.deleteTask({ name: legacyName })
    removed += 1
  } catch (e: unknown) {
    if (!isNotFoundError(e)) {
      const error = e instanceof Error ? e.message : String(e)
      logCt('delete.schedule.failed', { taskName: legacyName, error })
      throw new Error(
        `Cannot cancel scheduled send: failed to delete Cloud Tasks job (${error}). ` +
          'Grant cloudtasks.tasks.delete to the Cloud Run service account.',
        { cause: e }
      )
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
      if (taskId === legacyId) continue
      try {
        await conn.client.deleteTask({ name: task.name })
        removed += 1
      } catch {
        /* ignore */
      }
    }
  } catch (e: unknown) {
    // List cleans unique-suffix + leftover ids; legacy delete already succeeded/not-found.
    logCt('delete.schedule.list.skip', {
      campaignId,
      dbName,
      error: e instanceof Error ? e.message : String(e)
    })
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
