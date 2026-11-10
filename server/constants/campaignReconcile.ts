/** Shared safety-net settings for Sending + Schedule reconcile on web. */

/** Default tick interval (was 60s — too aggressive under webhook load). */
export const CAMPAIGN_RECONCILE_DEFAULT_INTERVAL_MS = 120_000

/** Floor so misconfigured env cannot hammer Mongo. */
export const CAMPAIGN_RECONCILE_MIN_INTERVAL_MS = 60_000

/** Max tenants processed per reconcile tick (rotates across the full client list). */
export const CAMPAIGN_RECONCILE_TENANT_BATCH_DEFAULT = 8

/** Pause between tenants so HTTP/webhook handlers can check out pool sockets. */
export const CAMPAIGN_RECONCILE_TENANT_YIELD_MS = 75

export const CAMPAIGN_RECONCILE_GATE_SKIP_LOG = 'skip (another campaign reconcile in progress)'

export function resolveCampaignReconcileIntervalMs(
  rawEnv: string | undefined,
  fallbackMs = CAMPAIGN_RECONCILE_DEFAULT_INTERVAL_MS
): number {
  const raw = Number(rawEnv)
  if (!Number.isFinite(raw) || raw <= 0) return fallbackMs
  return Math.max(CAMPAIGN_RECONCILE_MIN_INTERVAL_MS, Math.floor(raw))
}

export function resolveCampaignReconcileTenantBatchSize(
  rawEnv: string | undefined = process.env.CAMPAIGN_RECONCILE_TENANT_BATCH
): number {
  const raw = Number(rawEnv)
  if (!Number.isFinite(raw) || raw < 1) return CAMPAIGN_RECONCILE_TENANT_BATCH_DEFAULT
  return Math.min(50, Math.floor(raw))
}
