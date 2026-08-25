/** HTTP path Cloud Tasks POSTs for async Brevo transactional webhook ingest. */
export const BREVO_WEBHOOK_TASK_PATH = '/api/internal/brevo-webhooks/transactional'

export const BREVO_WEBHOOK_CLOUD_TASK_ID_PREFIX = 'bw-'

/** Same header as campaign send worker (shared send-worker service). */
export const BREVO_WEBHOOK_WORKER_SECRET_HEADER = 'X-Campaign-Send-Worker-Secret'

export const BREVO_WEBHOOK_SECRET_HEADERS = [
  'x-brevo-webhook-secret',
  'x-brevo-signature',
  'x-brevo-signature-v2',
  'x-mailin-custom'
] as const
