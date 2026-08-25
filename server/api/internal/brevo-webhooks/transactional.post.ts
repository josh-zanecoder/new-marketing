import { createError, defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'
import { getBrevoWebhookCloudTasksConfig } from '../../../config/brevoWebhookCloudTasks'
import { BREVO_WEBHOOK_WORKER_SECRET_HEADER } from '../../../constants/brevoWebhookTask'
import {
  parseBrevoWebhookWorkerBody,
  processBrevoWebhookWorkerTask
} from '../../../services/brevoWebhookWorker.service'

export default defineEventHandler(async (event) => {
  const cfg = getBrevoWebhookCloudTasksConfig()
  const secret =
    getHeader(event, BREVO_WEBHOOK_WORKER_SECRET_HEADER.toLowerCase()) ||
    getHeader(event, BREVO_WEBHOOK_WORKER_SECRET_HEADER) ||
    ''

  if (!cfg.workerSecret || secret !== cfg.workerSecret) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const raw = await readBody(event)
  const data = parseBrevoWebhookWorkerBody(raw)
  const result = await processBrevoWebhookWorkerTask(data)

  setResponseStatus(event, 200)
  return result
})
