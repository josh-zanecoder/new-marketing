import { defineStore } from 'pinia'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
import type { Campaign, CampaignSendCancelReport, SendStatus } from '~/types/campaign'
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  CAMPAIGN_SEND_POLL_INITIAL_MS,
  CAMPAIGN_SEND_POLL_INTERVAL_MS,
  CAMPAIGN_SEND_POLL_MAX_MS
} from '~/constants/campaignSendPolling'

export type { Campaign, SendStatus } from '~/types/campaign'

/** One global poll loop for the whole app (avoids duplicate timers per page). */
let sendPollTimeout: ReturnType<typeof setTimeout> | null = null
let sendPollGeneration = 0

/** Campaign id currently polled (modal send or detail-page resume). */
const sendPollCampaignId = ref<string | null>(null)

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

export const useCampaignStore = defineStore('campaigns', () => {
  const campaigns = ref<Campaign[]>([])
  const campaignsFetchedAt = ref(0)
  let campaignsInFlight: Promise<Campaign[]> | null = null
  /** Client cache for GET `/campaigns/:id` — instant detail navigation & post-save paint. */
  const campaignDetailCache = shallowRef(new Map<string, TenantCampaignDetail>())
  const sendingCampaignId = ref<string | null>(null)
  const sendStatus = ref<SendStatus | null>(null)
  const sendError = ref<string | null>(null)
  const sendCancelReport = ref<CampaignSendCancelReport | null>(null)

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
    sendCancelReport.value = null
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

  async function retryFailedCampaign(c: Campaign): Promise<{ poll: boolean }> {
    if (
      c.status !== 'Paused' &&
      c.status !== 'Failed' &&
      c.status !== 'Sent' &&
      c.status !== 'Cancelled'
    ) {
      sendError.value = 'This campaign cannot be resumed.'
      return { poll: false }
    }
    sendError.value = null
    sendCancelReport.value = null
    sendingCampaignId.value = c.id
    sendStatus.value = null
    try {
      const res = await $fetch<{
        ok: boolean
        total: number
        queued: number
        sent: number
        failed: number
        pending: number
      }>('/api/v1/tenant/send-campaign/retry-failed', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      if (!res?.queued) {
        sendError.value =
          c.status === 'Paused' || c.status === 'Cancelled'
            ? 'No unsent recipients to resume.'
            : 'No failed or pending recipients to retry.'
        return { poll: false }
      }
      sendStatus.value = {
        campaignId: c.id,
        campaignStatus: 'Sending',
        pending: res.pending,
        sent: res.sent,
        failed: res.failed,
        total: res.total,
        done: false
      }
      return { poll: true }
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to retry send')
      return { poll: false }
    }
  }

  async function sendAgainCampaign(c: Campaign): Promise<{ poll: boolean }> {
    if (c.status !== 'Paused' && c.status !== 'Failed' && c.status !== 'Cancelled') {
      sendError.value = 'This campaign cannot be sent again.'
      return { poll: false }
    }
    sendError.value = null
    sendCancelReport.value = null
    sendingCampaignId.value = c.id
    sendStatus.value = null
    try {
      const res = await $fetch<{
        ok: boolean
        total: number
        queued: number
        sent: number
        failed: number
        pending: number
      }>('/api/v1/tenant/send-campaign/send-again', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      if (!res?.queued) {
        sendError.value = 'No recipients to send to.'
        return { poll: false }
      }
      sendStatus.value = {
        campaignId: c.id,
        campaignStatus: 'Sending',
        pending: res.pending,
        sent: 0,
        failed: res.failed,
        total: res.total,
        done: false
      }
      return { poll: true }
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to send again')
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
      campaigns.value = campaigns.value.filter((x) => x.id !== c.id)
      await fetchCampaigns({ force: true })
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
      await fetchCampaigns({ force: true })
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

  function stopSendStatusPolling() {
    sendPollGeneration += 1
    sendPollCampaignId.value = null
    if (sendPollTimeout) {
      clearTimeout(sendPollTimeout)
      sendPollTimeout = null
    }
  }

  function isSendPolling(campaignId: string): boolean {
    return sendPollCampaignId.value === campaignId
  }

  async function fetchSendCampaignStatus(campaignId: string): Promise<SendStatus> {
    return $fetch<SendStatus>(`/api/v1/tenant/send-campaign/status/${campaignId}`, {
      timeout: 60000,
      ...apiFetchOptions(),
      ...serverAuthHeaders()
    })
  }

  /**
   * Poll send progress until `done`. Uses send POST counts for the modal until the first poll;
   * only one timer runs app-wide.
   */
  function startSendStatusPolling(
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    stopSendStatusPolling()
    sendPollCampaignId.value = campaignId
    const generation = sendPollGeneration
    let nextDelayMs = CAMPAIGN_SEND_POLL_INITIAL_MS

    const schedule = () => {
      sendPollTimeout = setTimeout(() => {
        void tick()
      }, nextDelayMs)
    }

    async function tick() {
      if (generation !== sendPollGeneration) return
      if (sendPollCampaignId.value !== campaignId) return

      try {
        const res = await fetchSendCampaignStatus(campaignId)
        if (generation !== sendPollGeneration) return
        sendStatus.value = { ...res, campaignId }

        if (res.done) {
          stopSendStatusPolling()
          if (sendingCampaignId.value === campaignId) {
            sendingCampaignId.value = null
          }
          sendStatus.value = null
          await fetchCampaigns({ force: true })
          await onComplete(res)
          return
        }

        nextDelayMs = Math.min(
          Math.round(nextDelayMs * 1.25),
          CAMPAIGN_SEND_POLL_MAX_MS
        )
        if (nextDelayMs < CAMPAIGN_SEND_POLL_INTERVAL_MS) {
          nextDelayMs = CAMPAIGN_SEND_POLL_INTERVAL_MS
        }
        schedule()
      } catch {
        if (sendingCampaignId.value === campaignId) {
          clearSendModal()
        } else {
          stopSendStatusPolling()
        }
      }
    }

    schedule()
  }

  /**
   * Poll progress for a campaign already sending (e.g. scheduled send started in background).
   * Does not open the send modal — use with inline progress on the detail page.
   */
  async function resumeSendStatusPolling(
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ): Promise<void> {
    if (sendPollCampaignId.value === campaignId) return
    try {
      const res = await fetchSendCampaignStatus(campaignId)
      const status: SendStatus = { ...res, campaignId }
      if (res.done) {
        await fetchCampaigns({ force: true })
        await onComplete(status)
        return
      }
      sendStatus.value = status
      startSendStatusPolling(campaignId, onComplete)
    } catch {
      // Status API unavailable; detail page still shows Sending badge from campaign fetch.
    }
  }

  async function pauseSendingCampaign(campaignId: string): Promise<CampaignSendCancelReport> {
    const res = await $fetch<{ report: CampaignSendCancelReport }>(
      '/api/v1/tenant/send-campaign/pause',
      {
        method: 'POST',
        body: { campaignId, confirm: true },
        timeout: 60000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      }
    )
    stopSendStatusPolling()
    const report = res.report
    sendCancelReport.value = report
    sendStatus.value = {
      campaignId,
      campaignStatus: report.campaignStatus || 'Paused',
      pending: 0,
      sent: report.counts.sent,
      failed: report.counts.failed,
      total: report.counts.total,
      done: true
    }
    await fetchCampaigns({ force: true })
    return report
  }

  async function cancelSendingCampaign(campaignId: string): Promise<CampaignSendCancelReport> {
    const res = await $fetch<{ report: CampaignSendCancelReport }>(
      '/api/v1/tenant/send-campaign/cancel',
      {
        method: 'POST',
        body: { campaignId, confirm: true },
        timeout: 60000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      }
    )
    stopSendStatusPolling()
    const report = res.report
    sendCancelReport.value = report
    sendStatus.value = {
      campaignId,
      campaignStatus: report.campaignStatus || 'Cancelled',
      pending: 0,
      sent: report.counts.sent,
      failed: report.counts.failed,
      total: report.counts.total,
      done: true
    }
    await fetchCampaigns({ force: true })
    return report
  }

  async function discardPausedCampaign(campaignId: string): Promise<void> {
    await $fetch('/api/v1/tenant/send-campaign/discard', {
      method: 'POST',
      body: { campaignId, confirm: true },
      timeout: 30000,
      ...apiFetchOptions(),
      ...serverAuthHeaders()
    })
    await fetchCampaigns({ force: true })
  }

  function clearSendModal() {
    stopSendStatusPolling()
    sendingCampaignId.value = null
    sendStatus.value = null
    sendError.value = null
    sendCancelReport.value = null
  }

  /** Close modal UI only; keep polling and live progress for inline banner. */
  function dismissSendModal() {
    sendingCampaignId.value = null
  }

  function openSendModal(campaignId: string) {
    sendingCampaignId.value = campaignId
  }

  return {
    campaigns,
    sendingCampaignId,
    sendStatus,
    sendError,
    sendCancelReport,
    fetchCampaigns,
    sendCampaign,
    retryFailedCampaign,
    sendAgainCampaign,
    pauseSendingCampaign,
    cancelSendingCampaign,
    discardPausedCampaign,
    deleteCampaign,
    duplicateCampaign,
    setSendStatus,
    setSendingCampaignId,
    startSendStatusPolling,
    resumeSendStatusPolling,
    stopSendStatusPolling,
    isSendPolling,
    clearSendModal,
    dismissSendModal,
    openSendModal,
    getCampaignDetailCache,
    setCampaignDetailCache,
    patchCampaignDetailCache,
    removeCampaignDetailCache,
    listRowFromDetail,
    upsertCampaignInList
  }
})
