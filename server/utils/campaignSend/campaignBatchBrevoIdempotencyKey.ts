import { createHash } from 'node:crypto'

/**
 * Stable Brevo idempotency key per logical batch (campaign + send run + page + recipient set).
 * Retries of the same batch with the same run/page/recipients dedupe at Brevo.
 */
export function campaignBatchBrevoIdempotencyKey(params: {
  campaignId: string
  sendRunId: string
  page: number
  recipientRowIds: string[]
}): string {
  const run = params.sendRunId.trim() || 'legacy'
  const sorted = [...params.recipientRowIds].sort()
  const chunkFp = createHash('sha256').update(sorted.join('\n'), 'utf8').digest('hex')
  return createHash('sha256')
    .update(`${params.campaignId}|${run}|${params.page}|${chunkFp}`, 'utf8')
    .digest('hex')
    .slice(0, 64)
}
