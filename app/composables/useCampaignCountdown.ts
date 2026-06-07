/** Tick `countdownNow` on an interval for scheduled-send countdowns. */
export function useCampaignCountdown(intervalMs = 30_000) {
  const countdownNow = ref(Date.now())
  let interval: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    interval = setInterval(() => {
      countdownNow.value = Date.now()
    }, intervalMs)
  })

  onUnmounted(() => {
    if (interval) clearInterval(interval)
  })

  return { countdownNow }
}
