/**
 * Safety net: if BullMQ delayed jobs are lost (Redis eviction, etc.), still send on time
 * by scanning Mongo for overdue Scheduled campaigns every minute.
 */
export default defineNitroPlugin(() => {
  if (process.env.SCHEDULE_RECONCILE_DISABLED === 'true') return

  const intervalMs = Math.max(
    25_000,
    Number(process.env.SCHEDULE_RECONCILE_INTERVAL_MS) || 60_000
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

  setTimeout(tick, 8_000)
  setInterval(tick, intervalMs)
})
