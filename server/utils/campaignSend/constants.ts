/** Recipients per BullMQ batch job (Brevo allows up to 99 per message version in one request). */
export const CAMPAIGN_SEND_BATCH_SIZE = 99

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
