export const ZC_MAIL_DEFAULT_BASE_URL = 'https://apizcmail.zanecoder.com'

export const ZC_MAIL_WEBHOOK_PATH = '/api/v1/webhooks/zc-mail/email-status'

export const ZC_MAIL_WEBHOOK_SIGNATURE_HEADER = 'x-zc-mail-signature'

export const ZC_MAIL_MESSAGE_ROUTING_COLLECTION = 'email_message_routing'

export const ZC_MAIL_ARCHIVE_PATH = '/v1/mail/archive'

export const ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT = 200

export const ZC_MAIL_ARCHIVE_STATS_MAX_PAGES = 25

/**
 * Parallel archive `q` lookups by CampaignRecipient SES/message id when
 * campaign/tag filters miss or return the wrong campaign.
 */
export const ZC_MAIL_ARCHIVE_MESSAGE_ID_Q_CONCURRENCY = 25

/** Max archive detail fetches per Tracking Refresh (SES open/click events). */
export const ZC_MAIL_ARCHIVE_DETAIL_MAX = 500

/** Parallel detail GETs per Refresh. Archive list scoping is campaign-tagged; keep polite under API limits. */
export const ZC_MAIL_ARCHIVE_DETAIL_CONCURRENCY = 30
