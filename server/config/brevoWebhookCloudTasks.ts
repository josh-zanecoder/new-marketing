import { BREVO_WEBHOOK_TASK_PATH } from '../constants/brevoWebhookTask'
import { CAMPAIGN_SEND_TASK_PATH } from '../utils/campaignSend/constants'

export type BrevoWebhookCloudTasksConfig = {
  enabled: boolean
  projectId: string
  location: string
  queueName: string
  workerUrl: string
  workerSecret: string
}

function resolveWorkerPostUrl(configured: string, fallbackBaseUrl: string): string {
  const raw = configured.trim()
  if (!raw) return `${fallbackBaseUrl.replace(/\/$/, '')}${BREVO_WEBHOOK_TASK_PATH}`
  try {
    const prefixed = raw.includes('://') ? raw : `https://${raw}`
    const u = new URL(prefixed)
    if (u.pathname === '/' || u.pathname === '') {
      return `${u.origin}${BREVO_WEBHOOK_TASK_PATH}`
    }
    if (u.pathname.includes(CAMPAIGN_SEND_TASK_PATH)) {
      return `${u.origin}${BREVO_WEBHOOK_TASK_PATH}`
    }
    return `${u.origin}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return `${raw.replace(/\/$/, '')}${BREVO_WEBHOOK_TASK_PATH}`
  }
}

function resolveFromCampaignWorkerUrl(campaignWorkerUrl: string): string {
  const raw = campaignWorkerUrl.trim()
  if (!raw) return ''
  try {
    const prefixed = raw.includes('://') ? raw : `https://${raw}`
    const u = new URL(prefixed)
    return `${u.origin}${BREVO_WEBHOOK_TASK_PATH}`
  } catch {
    return raw.replace(/\/api\/internal\/campaign-sends\/batch\/?$/, BREVO_WEBHOOK_TASK_PATH)
  }
}

export function getBrevoWebhookCloudTasksConfig(): BrevoWebhookCloudTasksConfig {
  const projectId =
    process.env.CLOUD_TASKS_PROJECT_ID?.trim() ||
    process.env.GCP_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    ''

  const location =
    process.env.CLOUD_TASKS_LOCATION?.trim() ||
    process.env.CLOUD_TASKS_REGION?.trim() ||
    process.env.GCP_REGION?.trim() ||
    'us-west1'

  const queueName =
    process.env.CLOUD_TASKS_QUEUE_NAME?.trim() ||
    process.env.TASK_QUEUE?.trim() ||
    'marketing-test'

  const fallbackBase =
    process.env.MARKETING_PUBLIC_BASE_URL?.trim() ||
    process.env.NUXT_PUBLIC_MARKETING_BASE_URL?.trim() ||
    process.env.MARKETING_APP_URL?.trim() ||
    `http://localhost:${process.env.NUXT_PORT || process.env.PORT || '3001'}`

  const explicitWorker = process.env.BREVO_WEBHOOK_WORKER_URL?.trim() || ''
  const campaignWorker =
    process.env.CAMPAIGN_SEND_WORKER_URL?.trim() ||
    process.env.CAMPAIGN_TASK_HANDLER_URL?.trim() ||
    ''

  const workerUrl = explicitWorker
    ? resolveWorkerPostUrl(explicitWorker, fallbackBase)
    : campaignWorker
      ? resolveFromCampaignWorkerUrl(campaignWorker)
      : `${fallbackBase.replace(/\/$/, '')}${BREVO_WEBHOOK_TASK_PATH}`

  const workerSecret = process.env.CAMPAIGN_SEND_WORKER_SECRET?.trim() || ''
  const asyncDisabled =
    String(process.env.BREVO_WEBHOOK_ASYNC_DISABLED || '').toLowerCase() === 'true'
  const ready = Boolean(projectId && location && queueName && workerSecret && !asyncDisabled)

  return {
    enabled: ready,
    projectId,
    location,
    queueName,
    workerUrl,
    workerSecret
  }
}

export function isBrevoWebhookCloudTasksEnabled(): boolean {
  return getBrevoWebhookCloudTasksConfig().enabled
}
