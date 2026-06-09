import {
  CAMPAIGN_SEND_BATCH_SIZE_MAX,
  CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED_DEFAULT,
  CAMPAIGN_SEND_FANOUT_DEFAULT
} from './constants'

/** Override with `CAMPAIGN_SEND_FANOUT_COUNT` (1–30). */
export function resolveCampaignSendFanoutCount(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_FANOUT_COUNT)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 30) return Math.floor(raw)
  return CAMPAIGN_SEND_FANOUT_DEFAULT
}

/**
 * How many batch tasks to enqueue for a new send wave.
 * Caps at fanout limit; scales down for small audiences.
 */
export function resolveCampaignSendFanoutTaskCount(pendingEstimate: number): number {
  const fanout = resolveCampaignSendFanoutCount()
  if (!Number.isFinite(pendingEstimate) || pendingEstimate <= 0) return fanout
  const batchEstimate = Math.max(
    1,
    Number(process.env.CAMPAIGN_SEND_FANOUT_BATCH_ESTIMATE) || CAMPAIGN_SEND_BATCH_SIZE_MAX
  )
  const needed = Math.ceil(pendingEstimate / batchEstimate)
  return Math.min(fanout, Math.max(1, needed))
}

/** @deprecated Use resolvePersonalizedCampaignBatchSize / resolveUniformCampaignBatchSize. */
export function resolveCampaignSendBatchSize(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE)
  if (Number.isFinite(raw) && raw >= 1 && raw <= CAMPAIGN_SEND_BATCH_SIZE_MAX) {
    return Math.floor(raw)
  }
  return CAMPAIGN_SEND_BATCH_SIZE_PERSONALIZED_DEFAULT
}

/**
 * Pause before each recipient send (ms). Set `CAMPAIGN_SEND_RECIPIENT_DELAY_MS` for slow-send / cancel testing.
 * `CAMPAIGN_SEND_BATCH_DELAY_MS` is accepted as a legacy alias.
 * Example: `60000` = 1 minute between each recipient.
 */
export function resolveCampaignSendRecipientDelayMs(): number {
  const raw =
    Number(process.env.CAMPAIGN_SEND_RECIPIENT_DELAY_MS) ||
    Number(process.env.CAMPAIGN_SEND_BATCH_DELAY_MS)
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return 0
}

/** @deprecated Use resolveCampaignSendRecipientDelayMs */
export const resolveCampaignSendBatchDelayMs = resolveCampaignSendRecipientDelayMs

export async function sleepCampaignSendRecipientDelayIfConfigured(
  log?: (message: string, details: Record<string, unknown>) => void
): Promise<number> {
  const delayMs = resolveCampaignSendRecipientDelayMs()
  if (delayMs <= 0) return 0
  log?.('recipient.delay', { delayMs })
  await new Promise((resolve) => setTimeout(resolve, delayMs))
  return delayMs
}

/** @deprecated Use sleepCampaignSendRecipientDelayIfConfigured */
export const sleepCampaignSendBatchDelayIfConfigured = sleepCampaignSendRecipientDelayIfConfigured
