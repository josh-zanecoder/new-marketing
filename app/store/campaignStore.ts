import { defineStore } from 'pinia'
import type { Campaign, SendStatus } from '~/types/campaign'

export type { Campaign, SendStatus } from '~/types/campaign'

/** SSR: internal API calls must forward the browser cookie or auth middleware returns 401. */
function serverAuthHeaders(): { headers?: HeadersInit } {
  if (!import.meta.server) return {}
  try {
    return { headers: useRequestHeaders(['cookie']) as HeadersInit }
  } catch {
    return {}
  }
}

/** Client: send session cookie with each request. */
function apiFetchOptions(): { credentials: RequestCredentials } {
  return { credentials: 'include' as RequestCredentials }
}

function fetchErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'data' in e) {
    const data = (e as { data?: { message?: string } }).data
    if (typeof data?.message === 'string' && data.message) return data.message
  }
  if (e instanceof Error && e.message) return e.message
  return fallback
}

export const useCampaignStore = defineStore('campaigns', () => {
  const campaigns = ref<Campaign[]>([])
  const sendingCampaignId = ref<string | null>(null)
  const sendStatus = ref<SendStatus | null>(null)
  const sendError = ref<string | null>(null)

  async function fetchCampaigns() {
    const res = await $fetch<{ campaigns: Campaign[] }>(
      '/api/v1/tenant/campaigns',
      {
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      }
    )
    campaigns.value = res?.campaigns ?? []
    return campaigns.value
  }

  async function sendCampaign(c: Campaign): Promise<{ poll: boolean }> {
    if (c.status !== 'Draft') return { poll: false }
    sendError.value = null
    sendingCampaignId.value = c.id
    sendStatus.value = null
    try {
      const res = await $fetch<{
        ok: boolean
        total: number
        valid: number
        invalid: number
        queued: number
        sent: number
        failed: number
        pending: number
      }>('/api/v1/tenant/send-campaign/send', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })

      if (res == null) {
        sendingCampaignId.value = null
        return { poll: false }
      }

      sendStatus.value = {
        campaignId: c.id,
        total: res.total,
        sent: res.sent,
        failed: res.failed,
        pending: res.pending,
        done: false,
        campaignStatus: 'Sending'
      }

      if (!res.queued) {
        sendingCampaignId.value = null
        sendStatus.value = {
          campaignStatus: 'Draft',
          pending: 0,
          sent: 0,
          failed: res.invalid,
          total: res.total,
          done: true
        }
        if (res.invalid > 0) {
          sendError.value =
            'No valid email addresses. Invalid addresses were marked as failed—fix them and send again.'
        }
        await fetchCampaigns()
        return { poll: false }
      }

      sendStatus.value = {
        campaignStatus: 'Sending',
        pending: res.queued,
        sent: 0,
        failed: res.invalid,
        total: res.total,
        done: false
      }

      return { poll: true }
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to start send')
      sendingCampaignId.value = null
      return { poll: false }
    }
  }

  async function deleteCampaign(c: Campaign) {
    try {
      await $fetch(`/api/v1/tenant/campaigns/${c.id}`, {
        method: 'DELETE',
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      await fetchCampaigns()
      return true
    } catch (e: unknown) {
      console.error('Delete failed:', e)
      return false
    }
  }

  async function duplicateCampaign(c: Campaign) {
    try {
      const res = await $fetch<{ id: string }>('/api/v1/tenant/campaigns/duplicate', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 10000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      if (res == null) return null
      await fetchCampaigns()
      return res.id
    } catch (e: unknown) {
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
