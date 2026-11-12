/** Wait before first status poll — send POST already returns initial counts. */
export const CAMPAIGN_SEND_POLL_INITIAL_MS = 2000

/** Interval between status polls while the BullMQ worker is still sending. */
export const CAMPAIGN_SEND_POLL_INTERVAL_MS = 2500

/** Max interval when backing off (large campaigns). */
export const CAMPAIGN_SEND_POLL_MAX_MS = 5000

/** Transient status-API failures before surfacing an error (keep polling). */
export const CAMPAIGN_SEND_POLL_MAX_CONSECUTIVE_ERRORS = 5

/** Copy when status polls keep failing while the campaign is still Sending. */
export const CAMPAIGN_SEND_POLL_ERROR_MESSAGE =
  'Could not load delivery stats. Sending may still be in progress — retrying…'
