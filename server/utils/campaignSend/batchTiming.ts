import { CAMPAIGN_SEND_BATCH_SIZE } from './constants'

/** Override with `CAMPAIGN_SEND_BATCH_SIZE` (1–500). */
export function resolveCampaignSendBatchSize(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_BATCH_SIZE)
  if (Number.isFinite(raw) && raw >= 1 && raw <= CAMPAIGN_SEND_BATCH_SIZE) {
    return Math.floor(raw)
  }
  return CAMPAIGN_SEND_BATCH_SIZE
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
