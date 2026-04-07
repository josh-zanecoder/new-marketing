import { defineStore } from 'pinia'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
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
  const campaignsFetchedAt = ref(0)
  let campaignsInFlight: Promise<Campaign[]> | null = null
  /** Client cache for GET `/campaigns/:id` — instant detail navigation & post-save paint. */
  const campaignDetailCache = shallowRef(new Map<string, TenantCampaignDetail>())
  const sendingCampaignId = ref<string | null>(null)
  const sendStatus = ref<SendStatus | null>(null)
  const sendError = ref<string | null>(null)

  function getCampaignDetailCache(id: string): TenantCampaignDetail | null {
    return campaignDetailCache.value.get(id) ?? null
  }

  function setCampaignDetailCache(id: string, detail: TenantCampaignDetail) {
    const m = new Map(campaignDetailCache.value)
    m.set(id, { ...detail })
    campaignDetailCache.value = m
  }

  function patchCampaignDetailCache(id: string, patch: Partial<TenantCampaignDetail>) {
    const cur = campaignDetailCache.value.get(id)
    if (!cur) return
    const m = new Map(campaignDetailCache.value)
    m.set(id, { ...cur, ...patch })
    campaignDetailCache.value = m
  }

  function removeCampaignDetailCache(id: string) {
    const m = new Map(campaignDetailCache.value)
    m.delete(id)
    campaignDetailCache.value = m
  }

  function listRowFromDetail(d: TenantCampaignDetail): Campaign {
    return {
      id: d.id,
      name: d.name,
      sender: d.sender,
      recipientsType: d.recipientsType,
      recipientsListId: d.recipientsListId,
      subject: d.subject,
      status: d.status,
      recipients: (d.recipients ?? []).map((r) => ({
        email: r.email,
        contactId: r.contactId,
        name: r.name,
        status: r.status,
        sentAt: r.sentAt,
        error: r.error
      })),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      scheduledAt: d.scheduledAt
    }
  }

  function upsertCampaignInList(row: Campaign) {
    const list = campaigns.value
    const i = list.findIndex((c) => c.id === row.id)
    if (i !== -1) list[i] = { ...list[i], ...row }
    else campaigns.value = [row, ...list]
  }

  async function fetchCampaigns(options?: { force?: boolean }) {
    const force = options?.force === true
    const now = Date.now()
    const hasRecentCache = campaigns.value.length > 0 && now - campaignsFetchedAt.value < 15000
    if (!force && hasRecentCache) return campaigns.value
    if (campaignsInFlight) return campaignsInFlight

    campaignsInFlight = (async () => {
      const res = await $fetch<{ campaigns: Campaign[] }>(
        '/api/v1/tenant/campaigns',
        {
          ...apiFetchOptions(),
          ...serverAuthHeaders()
        }
      )
      campaigns.value = res?.campaigns ?? []
      campaignsFetchedAt.value = Date.now()
      return campaigns.value
    })()

    try {
      return await campaignsInFlight
    } finally {
      campaignsInFlight = null
    }
  }

  async function sendCampaign(c: Campaign): Promise<{ poll: boolean }> {
    if (c.status !== 'Draft') {
      sendError.value = 'Campaign cannot be sent in its current status.'
      sendingCampaignId.value = c.id
      sendStatus.value = null
      return { poll: false }
    }
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
        sendError.value = 'Unexpected response from server.'
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
        const campaignStatus = res.valid === 0 ? 'Failed' : 'Sent'
        sendStatus.value = {
          campaignId: c.id,
          campaignStatus,
          pending: 0,
          sent: res.sent,
          failed: res.failed,
          total: res.total,
          done: true
        }
        if (res.valid === 0) {
          sendError.value =
            'No valid email addresses. Invalid addresses were marked as failed—fix them and send again.'
        }
        await fetchCampaigns()
        return { poll: false }
      }

      sendStatus.value = {
        campaignId: c.id,
        campaignStatus: 'Sending',
        pending: res.queued,
        sent: 0,
        failed: res.failed,
        total: res.total,
        done: false
      }

      return { poll: true }
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to start send')
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
      removeCampaignDetailCache(c.id)
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
    clearSendModal,
    getCampaignDetailCache,
    setCampaignDetailCache,
    patchCampaignDetailCache,
    removeCampaignDetailCache,
    listRowFromDetail,
    upsertCampaignInList
  }
})
