import { defineStore } from 'pinia'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
import type { SendStatus } from '~/types/campaign'
import type { AdminCampaign } from '~/types/adminCampaign'
import { adminCampaignKey } from '~/types/adminCampaign'
import { ADMIN_TENANT_DB_HEADER } from '~/constants/adminTenantProxy'
import {
  CAMPAIGN_SEND_POLL_INITIAL_MS,
  CAMPAIGN_SEND_POLL_INTERVAL_MS,
  CAMPAIGN_SEND_POLL_MAX_MS
} from '~/constants/campaignSendPolling'

export type { AdminCampaign, SendStatus } from '~/types/adminCampaign'

/** One global poll loop for admin campaign sends. */
let adminSendPollTimeout: ReturnType<typeof setTimeout> | null = null
let adminSendPollGeneration = 0

/** Composite key `${tenantDbName}:${campaignId}` currently polled. */
const adminSendPollKey = ref<string | null>(null)

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

function tenantProxyHeaders(dbName: string): HeadersInit {
  return { [ADMIN_TENANT_DB_HEADER]: dbName.trim() }
}

function adminFetchInit(dbName: string, init?: Record<string, unknown>): Record<string, unknown> {
  const serverHeaders = serverAuthHeaders().headers
  const proxy = tenantProxyHeaders(dbName)
  const mergedHeaders = {
    ...(typeof serverHeaders === 'object' && serverHeaders !== null ? serverHeaders : {}),
    ...proxy
  }
  return {
    credentials: 'include' as RequestCredentials,
    headers: mergedHeaders,
    ...init
  }
}

export const useAdminCampaignStore = defineStore('adminCampaigns', () => {
  const campaigns = ref<AdminCampaign[]>([])
  const campaignsFetchedAt = ref(0)
  let campaignsInFlight: Promise<AdminCampaign[]> | null = null
  /** Client cache for GET `/campaigns/:id` — instant detail navigation & post-save paint. */
  const campaignDetailCache = shallowRef(new Map<string, TenantCampaignDetail>())
  const sendingCampaignKey = ref<string | null>(null)
  const sendStatus = ref<SendStatus | null>(null)
  const sendError = ref<string | null>(null)

  function getCampaignDetailCache(tenantDbName: string, id: string): TenantCampaignDetail | null {
    return campaignDetailCache.value.get(adminCampaignKey({ tenantDbName, id })) ?? null
  }

  function setCampaignDetailCache(tenantDbName: string, id: string, detail: TenantCampaignDetail) {
    const m = new Map(campaignDetailCache.value)
    m.set(adminCampaignKey({ tenantDbName, id }), { ...detail })
    campaignDetailCache.value = m
  }

  function patchCampaignDetailCache(
    tenantDbName: string,
    id: string,
    patch: Partial<TenantCampaignDetail>
  ) {
    const key = adminCampaignKey({ tenantDbName, id })
    const cur = campaignDetailCache.value.get(key)
    if (!cur) return
    const m = new Map(campaignDetailCache.value)
    m.set(key, { ...cur, ...patch })
    campaignDetailCache.value = m
  }

  function removeCampaignDetailCache(tenantDbName: string, id: string) {
    const m = new Map(campaignDetailCache.value)
    m.delete(adminCampaignKey({ tenantDbName, id }))
    campaignDetailCache.value = m
  }

  function listRowFromDetail(tenantDbName: string, tenantName: string, d: TenantCampaignDetail): AdminCampaign {
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
      scheduledAt: d.scheduledAt,
      tenantDbName,
      tenantName
    }
  }

  function upsertCampaignInList(row: AdminCampaign) {
    const list = campaigns.value
    const i = list.findIndex(
      (c) => c.id === row.id && c.tenantDbName === row.tenantDbName
    )
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
      const res = await $fetch<{ campaigns: AdminCampaign[] }>(
        '/api/v1/admin/campaigns',
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

  async function sendCampaign(c: AdminCampaign): Promise<{ poll: boolean }> {
    const key = adminCampaignKey(c)
    if (c.status !== 'Draft' && c.status !== 'Scheduled') {
      sendError.value = 'Campaign cannot be sent in its current status.'
      sendingCampaignKey.value = key
      sendStatus.value = null
      return { poll: false }
    }
    sendError.value = null
    sendingCampaignKey.value = key
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
        ...adminFetchInit(c.tenantDbName)
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

  async function retryFailedCampaign(c: AdminCampaign): Promise<{ poll: boolean }> {
    const key = adminCampaignKey(c)
    if (c.status !== 'Failed' && c.status !== 'Sent') {
      sendError.value = 'Only completed campaigns with failures can be retried.'
      return { poll: false }
    }
    sendError.value = null
    sendingCampaignKey.value = key
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
        ...adminFetchInit(c.tenantDbName)
      })
      if (!res?.queued) {
        sendError.value = 'No failed or pending recipients to retry.'
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

  async function pauseCampaignSend(c: AdminCampaign): Promise<boolean> {
    const key = adminCampaignKey(c)
    sendError.value = null
    try {
      await $fetch('/api/v1/tenant/send-campaign/pause', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...adminFetchInit(c.tenantDbName)
      })
      if (sendingCampaignKey.value === key || adminSendPollKey.value === key) {
        stopSendStatusPolling()
        sendingCampaignKey.value = null
        sendStatus.value = null
      }
      await fetchCampaigns({ force: true })
      return true
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to pause send')
      return false
    }
  }

  async function stopCampaignSend(c: AdminCampaign): Promise<boolean> {
    const key = adminCampaignKey(c)
    sendError.value = null
    try {
      await $fetch('/api/v1/tenant/send-campaign/stop', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...adminFetchInit(c.tenantDbName)
      })
      if (sendingCampaignKey.value === key || adminSendPollKey.value === key) {
        stopSendStatusPolling()
        sendingCampaignKey.value = null
        sendStatus.value = null
      }
      await fetchCampaigns({ force: true })
      return true
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to stop send')
      return false
    }
  }

  async function stopAllCampaignSends(): Promise<boolean> {
    sendError.value = null
    try {
      await $fetch('/api/v1/admin/campaigns/stop-all', {
        method: 'POST',
        timeout: 60000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      stopSendStatusPolling()
      sendingCampaignKey.value = null
      sendStatus.value = null
      await fetchCampaigns({ force: true })
      return true
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to stop active sends')
      return false
    }
  }

  async function cancelAllActiveCampaignSends(tenantDbName?: string): Promise<boolean> {
    sendError.value = null
    try {
      await $fetch('/api/v1/admin/campaigns/cancel-all-active', {
        method: 'POST',
        body: tenantDbName ? { tenantDbName } : {},
        timeout: 120000,
        ...apiFetchOptions(),
        ...serverAuthHeaders()
      })
      stopSendStatusPolling()
      sendingCampaignKey.value = null
      sendStatus.value = null
      await fetchCampaigns({ force: true })
      return true
    } catch (e: unknown) {
      sendError.value = fetchErrorMessage(e, 'Failed to cancel active sends')
      return false
    }
  }

  async function resumeCampaignSend(c: AdminCampaign): Promise<{ poll: boolean }> {
    const key = adminCampaignKey(c)
    if (c.status !== 'Paused' && c.status !== 'Stopped') {
      sendError.value = 'Only paused or stopped campaigns can be resumed.'
      return { poll: false }
    }
    sendError.value = null
    sendingCampaignKey.value = key
    sendStatus.value = null
    try {
      const res = await $fetch<{
        ok: boolean
        total: number
        queued: number
        sent: number
        failed: number
        pending: number
      }>('/api/v1/tenant/send-campaign/resume', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...adminFetchInit(c.tenantDbName)
      })
      if (!res?.queued) {
        sendError.value = 'No pending recipients to resume.'
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
      sendError.value = fetchErrorMessage(e, 'Failed to resume send')
      return { poll: false }
    }
  }

  async function restartCampaignSend(c: AdminCampaign): Promise<{ poll: boolean }> {
    const key = adminCampaignKey(c)
    if (c.status !== 'Paused' && c.status !== 'Stopped') {
      sendError.value = 'Only paused or stopped campaigns can be sent again.'
      return { poll: false }
    }
    sendError.value = null
    sendingCampaignKey.value = key
    sendStatus.value = null
    try {
      const res = await $fetch<{
        ok: boolean
        total: number
        queued: number
        sent: number
        failed: number
        pending: number
      }>('/api/v1/tenant/send-campaign/restart', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 30000,
        ...adminFetchInit(c.tenantDbName)
      })
      if (!res?.queued) {
        sendError.value = 'No recipients to send again.'
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
      sendError.value = fetchErrorMessage(e, 'Failed to send campaign again')
      return { poll: false }
    }
  }

  async function deleteCampaign(c: AdminCampaign) {
    try {
      await $fetch(`/api/v1/tenant/campaigns/${c.id}`, {
        method: 'DELETE',
        ...adminFetchInit(c.tenantDbName)
      })
      removeCampaignDetailCache(c.tenantDbName, c.id)
      campaigns.value = campaigns.value.filter(
        (x) => !(x.id === c.id && x.tenantDbName === c.tenantDbName)
      )
      await fetchCampaigns({ force: true })
      return true
    } catch (e: unknown) {
      console.error('Delete failed:', e)
      return false
    }
  }

  async function duplicateCampaign(c: AdminCampaign) {
    try {
      const res = await $fetch<{ id: string }>('/api/v1/tenant/campaigns/duplicate', {
        method: 'POST',
        body: { campaignId: c.id },
        timeout: 10000,
        ...adminFetchInit(c.tenantDbName)
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

  function setSendingCampaignKey(key: string | null) {
    sendingCampaignKey.value = key
  }

  function stopSendStatusPolling() {
    adminSendPollGeneration += 1
    adminSendPollKey.value = null
    if (adminSendPollTimeout) {
      clearTimeout(adminSendPollTimeout)
      adminSendPollTimeout = null
    }
  }

  function isSendPolling(tenantDbName: string, campaignId: string): boolean {
    return adminSendPollKey.value === adminCampaignKey({ tenantDbName, id: campaignId })
  }

  async function fetchSendCampaignStatus(
    tenantDbName: string,
    campaignId: string
  ): Promise<SendStatus> {
    return $fetch<SendStatus>(`/api/v1/tenant/send-campaign/status/${campaignId}`, {
      timeout: 60000,
      ...adminFetchInit(tenantDbName)
    })
  }

  function startSendStatusPolling(
    tenantDbName: string,
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ) {
    const pollKey = adminCampaignKey({ tenantDbName, id: campaignId })
    stopSendStatusPolling()
    adminSendPollKey.value = pollKey
    const generation = adminSendPollGeneration
    let nextDelayMs = CAMPAIGN_SEND_POLL_INITIAL_MS

    const schedule = () => {
      adminSendPollTimeout = setTimeout(() => {
        void tick()
      }, nextDelayMs)
    }

    async function tick() {
      if (generation !== adminSendPollGeneration) return
      if (adminSendPollKey.value !== pollKey) return

      try {
        const res = await fetchSendCampaignStatus(tenantDbName, campaignId)
        if (generation !== adminSendPollGeneration) return
        sendStatus.value = { ...res, campaignId }

        if (res.done) {
          stopSendStatusPolling()
          if (sendingCampaignKey.value === pollKey) {
            sendingCampaignKey.value = null
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
        if (sendingCampaignKey.value === pollKey) {
          clearSendModal()
        } else {
          stopSendStatusPolling()
        }
      }
    }

    schedule()
  }

  async function resumeSendStatusPolling(
    tenantDbName: string,
    campaignId: string,
    onComplete: (res: SendStatus) => void | Promise<void>
  ): Promise<void> {
    const pollKey = adminCampaignKey({ tenantDbName, id: campaignId })
    if (adminSendPollKey.value === pollKey) return
    try {
      const res = await fetchSendCampaignStatus(tenantDbName, campaignId)
      const status: SendStatus = { ...res, campaignId }
      if (res.done) {
        await fetchCampaigns({ force: true })
        await onComplete(status)
        return
      }
      sendStatus.value = status
      startSendStatusPolling(tenantDbName, campaignId, onComplete)
    } catch {
      /* status unavailable */
    }
  }

  function clearSendModal() {
    stopSendStatusPolling()
    sendingCampaignKey.value = null
    sendStatus.value = null
    sendError.value = null
  }

  /** Close modal UI only; keep polling and live progress for inline banner. */
  function dismissSendModal() {
    sendingCampaignKey.value = null
  }

  function openSendModal(tenantDbName: string, campaignId: string) {
    sendingCampaignKey.value = adminCampaignKey({ tenantDbName, id: campaignId })
  }

  return {
    campaigns,
    sendingCampaignKey,
    sendStatus,
    sendError,
    fetchCampaigns,
    sendCampaign,
    retryFailedCampaign,
    pauseCampaignSend,
    stopCampaignSend,
    stopAllCampaignSends,
    cancelAllActiveCampaignSends,
    resumeCampaignSend,
    restartCampaignSend,
    deleteCampaign,
    duplicateCampaign,
    setSendStatus,
    setSendingCampaignKey,
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
