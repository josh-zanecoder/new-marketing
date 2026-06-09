import { CAMPAIGN_SEND_TASK_PATH } from '../utils/campaignSend/constants'

function normalizePrivateKeyFromEnv(raw: string | undefined): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined
  let key = raw.trim()
  if (!key) return undefined
  key = key.replace(/^['"`](.*?)['"`]$/s, '$1')
  key = key.replace(/\\n/g, '\n')
  key = key.replace(/\\\\n/g, '\n')
  key = key.replace(/\r\n/g, '\n')
  return key
}

export type CampaignCloudTasksConfig = {
  enabled: boolean
  projectId: string
  location: string
  queueName: string
  workerUrl: string
  workerSecret: string
}

export type CampaignCloudTasksAuthMode = 'key_file' | 'explicit_credentials' | 'application_default'

export type CampaignCloudTasksClientAuth = {
  keyFilename?: string
  credentials?: { client_email: string; private_key: string }
}

/** Auth for Cloud Tasks API. Never uses Firebase credentials (different project / wrong IAM). */
export function getCampaignCloudTasksClientAuth(): CampaignCloudTasksClientAuth {
  const taskKeyFile = process.env.CLOUD_TASKS_KEY_FILENAME?.trim()
  if (taskKeyFile) return { keyFilename: taskKeyFile }

  const taskEmail = process.env.CLOUD_TASKS_CLIENT_EMAIL?.trim()
  const taskKey = normalizePrivateKeyFromEnv(process.env.CLOUD_TASKS_PRIVATE_KEY)
  if (taskEmail && taskKey) {
    return { credentials: { client_email: taskEmail, private_key: taskKey } }
  }

  const gcpEmail = process.env.GCP_CLIENT_EMAIL?.trim()
  const gcpKey = normalizePrivateKeyFromEnv(process.env.GCP_PRIVATE_KEY)
  if (gcpEmail && gcpKey) {
    return { credentials: { client_email: gcpEmail, private_key: gcpKey } }
  }

  return {}
}

export function resolveCampaignCloudTasksAuth(): {
  mode: CampaignCloudTasksAuthMode
  principal?: string
  auth: CampaignCloudTasksClientAuth
} {
  const auth = getCampaignCloudTasksClientAuth()
  if (auth.keyFilename) {
    return { mode: 'key_file', auth }
  }
  if (auth.credentials?.client_email) {
    return {
      mode: 'explicit_credentials',
      principal: auth.credentials.client_email,
      auth
    }
  }
  return { mode: 'application_default', auth }
}

function resolveWorkerPostUrl(configured: string, fallbackBaseUrl: string): string {
  const raw = configured.trim()
  if (!raw) return `${fallbackBaseUrl.replace(/\/$/, '')}${CAMPAIGN_SEND_TASK_PATH}`
  try {
    const prefixed = raw.includes('://') ? raw : `https://${raw}`
    const u = new URL(prefixed)
    if (u.pathname === '/' || u.pathname === '') {
      return `${u.origin}${CAMPAIGN_SEND_TASK_PATH}`
    }
    return `${u.origin}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return `${raw.replace(/\/$/, '')}${CAMPAIGN_SEND_TASK_PATH}`
  }
}

export function getCampaignCloudTasksConfig(): CampaignCloudTasksConfig {
  const enabled =
    String(process.env.CLOUD_TASKS_ENABLED || '').toLowerCase() === 'true' ||
    String(process.env.CAMPAIGN_SEND_CLOUD_TASKS_ENABLED || '').toLowerCase() === 'true'

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

  const configuredWorker =
    process.env.CAMPAIGN_SEND_WORKER_URL?.trim() ||
    process.env.CAMPAIGN_TASK_HANDLER_URL?.trim() ||
    ''

  const workerUrl = resolveWorkerPostUrl(configuredWorker, fallbackBase)
  const workerSecret = process.env.CAMPAIGN_SEND_WORKER_SECRET?.trim() || ''

  const ready = Boolean(projectId && location && queueName && workerSecret)

  return {
    enabled: enabled && ready,
    projectId,
    location,
    queueName,
    workerUrl,
    workerSecret
  }
}

export function isCampaignCloudTasksEnabled(): boolean {
  return getCampaignCloudTasksConfig().enabled
}
