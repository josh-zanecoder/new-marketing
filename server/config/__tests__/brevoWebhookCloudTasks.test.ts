import { afterEach, describe, expect, it } from 'vitest'
import { getBrevoWebhookCloudTasksConfig } from '@server/config/brevoWebhookCloudTasks'
import { BREVO_WEBHOOK_TASK_PATH } from '@server/constants/brevoWebhookTask'

describe('getBrevoWebhookCloudTasksConfig', () => {
  const envBackup = { ...process.env }

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('derives worker URL from campaign send worker origin', () => {
    process.env.CLOUD_TASKS_PROJECT_ID = 'poc-1-aima-pmu'
    process.env.CLOUD_TASKS_LOCATION = 'us-west1'
    process.env.CLOUD_TASKS_QUEUE_NAME = 'marketing-production'
    process.env.CAMPAIGN_SEND_WORKER_SECRET = 'secret'
    process.env.CAMPAIGN_SEND_WORKER_URL =
      'https://marketing-send-worker-production-7tcd3qtubq-uw.a.run.app/api/internal/campaign-sends/batch'

    const cfg = getBrevoWebhookCloudTasksConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.workerUrl).toBe(
      'https://marketing-send-worker-production-7tcd3qtubq-uw.a.run.app/api/internal/brevo-webhooks/transactional'
    )
    expect(cfg.workerUrl.endsWith(BREVO_WEBHOOK_TASK_PATH)).toBe(true)
  })

  it('is disabled when async flag is set', () => {
    process.env.CLOUD_TASKS_PROJECT_ID = 'poc-1-aima-pmu'
    process.env.CLOUD_TASKS_LOCATION = 'us-west1'
    process.env.CLOUD_TASKS_QUEUE_NAME = 'marketing-production'
    process.env.CAMPAIGN_SEND_WORKER_SECRET = 'secret'
    process.env.BREVO_WEBHOOK_ASYNC_DISABLED = 'true'

    expect(getBrevoWebhookCloudTasksConfig().enabled).toBe(false)
  })
})
