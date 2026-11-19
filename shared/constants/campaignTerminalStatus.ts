/** Campaign statuses where an in-flight send UI must not stay open. */
export const CAMPAIGN_STATUS_SENT = 'Sent'
export const CAMPAIGN_STATUS_FAILED = 'Failed'

export const CAMPAIGN_TERMINAL_SEND_STATUSES = [
  CAMPAIGN_STATUS_SENT,
  CAMPAIGN_STATUS_FAILED
] as const

export type CampaignTerminalSendStatus =
  (typeof CAMPAIGN_TERMINAL_SEND_STATUSES)[number]
