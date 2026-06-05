/** Wait before first status poll — send POST already returns initial counts. */
export const CAMPAIGN_SEND_POLL_INITIAL_MS = 2000

/** Interval between status polls while the BullMQ worker is still sending. */
export const CAMPAIGN_SEND_POLL_INTERVAL_MS = 2500

/** Max interval when backing off (large campaigns). */
export const CAMPAIGN_SEND_POLL_MAX_MS = 5000
