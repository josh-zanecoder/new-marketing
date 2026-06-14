/** Worker-side Mongo upsert batch size per Kafka `marketing.sync.requested` message (CRM may send up to 500). */
export const MARKETING_INBOUND_SYNC_UPSERT_BATCH_SIZE_DEFAULT = 250

export function resolveMarketingInboundSyncUpsertBatchSize(): number {
  const raw = Number(process.env.MARKETING_INBOUND_SYNC_UPSERT_BATCH_SIZE)
  if (Number.isFinite(raw) && raw >= 1 && raw <= 500) return Math.floor(raw)
  return MARKETING_INBOUND_SYNC_UPSERT_BATCH_SIZE_DEFAULT
}
