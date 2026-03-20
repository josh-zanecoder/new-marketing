import { defineStore } from 'pinia'
import type { Campaign, SendStatus } from '~/types/campaign'

export type { Campaign, SendStatus } from '~/types/campaign'

export const useCampaignStore = defineStore('campaigns', () => {
  const campaigns = ref<Campaign[]>([])
  const sendingCampaignId = ref<string | null>(null)
  const sendStatus = ref<SendStatus | null>(null)
  const sendError = ref<string | null>(null)

  async function fetchCampaigns() {
    const res = await $fetch<{ campaigns: Campaign[] }>('/api/v1/campaigns')
    campaigns.value = res?.campaigns ?? []
    return campaigns.value
  }

  async function sendCampaign(c: Campaign) {
    if (c.status !== 'Draft') return
    sendError.value = null
    sendingCampaignId.value = c.id
    sendStatus.value = null
    try {
      await $fetch('/api/v1/send-campaign/send', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000
      })
      return true
    } catch (e: any) {
      sendError.value = e?.data?.message || e?.message || 'Failed to start send'
      sendingCampaignId.value = null
      return false
    }
  }

  async function deleteCampaign(c: Campaign) {
    try {
      await $fetch(`/api/v1/campaigns/${c.id}`, { method: 'DELETE' })
      await fetchCampaigns()
      return true
    } catch (e: any) {
      console.error('Delete failed:', e)
      return false
    }
  }

  async function duplicateCampaign(c: Campaign) {
    try {
      const res = await $fetch<{ id: string }>('/api/v1/campaigns/duplicate', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 10000
      })
      await fetchCampaigns()
      return res.id
    } catch (e: any) {
      console.error('Duplicate failed:', e)
      return null
    }
  }

  function setSendStatus(status: SendStatus | null) {
    sendStatus.value = status
  }

  function setSendingCampaignId(id: string | null) {
    sendingCampaignId.value = id
  }

  function clearSendModal() {
    sendingCampaignId.value = null
    sendStatus.value = null
    sendError.value = null
  }

  return {
    campaigns,
    sendingCampaignId,
    sendStatus,
    sendError,
    fetchCampaigns,
    sendCampaign,
    deleteCampaign,
    duplicateCampaign,
    setSendStatus,
    setSendingCampaignId,
    clearSendModal
  }
})
