/**
 * Safety net: campaigns left in `Sending` when BullMQ jobs fail, Redis evicts jobs,
 * or the worker was down during enqueue.
 */
export default defineNitroPlugin(() => {
  if (process.env.SENDING_RECONCILE_DISABLED === 'true') return

  const intervalMs = Math.max(
    25_000,
    Number(process.env.SENDING_RECONCILE_INTERVAL_MS) || 60_000
  )

  let busy = false
  function tick() {
    if (busy) return
    busy = true
    import('../services/reconcileStuckSendingCampaigns')
      .then(({ reconcileStuckSendingCampaigns }) => reconcileStuckSendingCampaigns())
      .catch((e) => console.error('[SendingReconcile] tick failed', e))
      .finally(() => {
        busy = false
      })
  }

  setTimeout(tick, 12_000)
  setInterval(tick, intervalMs)
})
