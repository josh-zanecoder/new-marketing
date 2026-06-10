/** Recipients per BullMQ batch job (Brevo messageVersions limit; aligned with mortdash ratesheet max chunk). */
export const CAMPAIGN_SEND_BATCH_SIZE = 100

/** Serial batch processing per worker (ratesheet-style); override for local experiments only. */
export const CAMPAIGN_EMAIL_WORKER_CONCURRENCY_DEFAULT = 1

export const CAMPAIGN_SEND_MAX_RETRY_ATTEMPTS = 3
export const CAMPAIGN_SEND_RETRY_BASE_DELAY_MS = 5000

/** Mark stale `sending` rows failed so a stuck batch can retry. Default 2h. */
export const CAMPAIGN_SEND_STALE_SENDING_MS_DEFAULT = 2 * 60 * 60 * 1000

/** Reconcile: treat long-lived `sending` as delivered (worker lost DB ack). Default 3m. */
export const CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS_DEFAULT = 3 * 60 * 1000

export const CAMPAIGN_RECIPIENT_STATUS_PENDING = 'pending'
export const CAMPAIGN_RECIPIENT_STATUS_SENDING = 'sending'
export const CAMPAIGN_RECIPIENT_STATUS_SENT = 'sent'
export const CAMPAIGN_RECIPIENT_STATUS_FAILED = 'failed'
