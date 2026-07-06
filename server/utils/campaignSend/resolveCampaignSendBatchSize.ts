import { CAMPAIGN_SEND_BATCH_SIZE } from './constants'

/** Conservative Brevo transactional request body budget (documented max ~20MB). */
export const BREVO_CAMPAIGN_BATCH_PAYLOAD_BUDGET_BYTES = 3 * 1024 * 1024

const PER_VERSION_JSON_OVERHEAD_BYTES = 600

/**
 * Non-uniform Brevo `messageVersions` repeat merged HTML on the root payload and each version.
 * Pre-merge template length is a close enough estimate for batch sizing.
 */
export function estimateBrevoBytesPerPersonalizedRecipient(templateHtmlByteLength: number): number {
  const html = Math.max(0, templateHtmlByteLength)
  if (html === 0) return PER_VERSION_JSON_OVERHEAD_BYTES
  return html * 2 + PER_VERSION_JSON_OVERHEAD_BYTES
}

export function resolveCampaignSendBatchSize(templateHtml: string | null | undefined): number {
  const bytes = Buffer.byteLength(String(templateHtml ?? ''), 'utf8')
  if (bytes === 0) return CAMPAIGN_SEND_BATCH_SIZE
  const perRecipient = estimateBrevoBytesPerPersonalizedRecipient(bytes)
  const byBudget = Math.floor(BREVO_CAMPAIGN_BATCH_PAYLOAD_BUDGET_BYTES / perRecipient)
  return Math.max(1, Math.min(CAMPAIGN_SEND_BATCH_SIZE, byBudget))
}

export function chunkCampaignSendBatch<T>(items: T[], maxChunkSize: number): T[][] {
  const size = Math.max(1, maxChunkSize)
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
