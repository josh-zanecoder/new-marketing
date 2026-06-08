type CampaignViewTab = 'details' | 'tracking'

/** Refreshes tracking child components each time the Tracking tab is opened. */
export function useCampaignTrackingTab(initialTab: CampaignViewTab = 'details') {
  const campaignViewTab = ref<CampaignViewTab>(initialTab)
  const trackingSessionKey = ref(0)

  watch(campaignViewTab, (tab) => {
    if (tab === 'tracking') trackingSessionKey.value += 1
  })

  return { campaignViewTab, trackingSessionKey }
}
