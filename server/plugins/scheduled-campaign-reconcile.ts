import { resolveCampaignReconcileIntervalMs } from '../constants/campaignReconcile'

/**
 * Scheduled campaign safety net (Mongo + BullMQ only — not Kafka).
 * If delayed BullMQ jobs are lost (Redis eviction, etc.), scans for overdue `Scheduled` campaigns.
 */
export default defineNitroPlugin(() => {
  if (process.env.SCHEDULE_RECONCILE_DISABLED === 'true') return

  const intervalMs = resolveCampaignReconcileIntervalMs(
    process.env.SCHEDULE_RECONCILE_INTERVAL_MS
  )

  let busy = false
  function tick() {
    if (busy) return
    busy = true
    import('../services/reconcileScheduledCampaigns')
      .then(({ reconcileOverdueScheduledCampaigns }) => reconcileOverdueScheduledCampaigns())
      .catch((e) => console.error('[ScheduleReconcile] tick failed', e))
      .finally(() => {
        busy = false
      })
  }

  void import('../lib/mongoose')
    .then(({ getRegistryConnection }) => getRegistryConnection())
    .then(() => {
      // Offset from SendingReconcile (12s) so startup ticks do not collide.
      setTimeout(tick, 20_000)
      setInterval(tick, intervalMs)
    })
    .catch((e) => console.error('[ScheduleReconcile] startup failed', e))
})
