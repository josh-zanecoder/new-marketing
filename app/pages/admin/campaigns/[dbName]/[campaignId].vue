<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { AdminCampaign } from '~/types/adminCampaign'
import { adminCampaignKey } from '~/types/adminCampaign'
import { useAdminCampaignStore } from '~/store/adminCampaignStore'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
import {
  canStopSend,
  canResumeSend,
  canRestartSend,
  buildCampaignSendProgress
} from '~/composables/useCampaignSendFlow'
import { useAdminCampaignSendFlow } from '~/composables/admin/campaigns/useAdminCampaignSendFlow'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'
import { CONTACT_OWNER_SENDER_LABEL } from '~~/shared/contactOwnerSender'

import { forceReleaseMarketingScrollLock } from '~/composables/useMarketingScrollLock'

definePageMeta({ layout: 'admin' })

const currentRoute = useRoute()
const tenantDbName = computed(() => String(currentRoute.params.dbName ?? '').trim())
const id = computed(() => String(currentRoute.params.campaignId ?? '').trim())

const campaignStore = useAdminCampaignStore()
const { sendingCampaignKey, sendError, sendStatus } = storeToRefs(campaignStore)
const marketingApi = useTenantMarketingApi({ adminTenantDb: tenantDbName })
const {
  sendProgress,
  startSendStatusPolling,
  resumeSendStatusPolling,
  isSendPolling,
  closeSendModal,
  dismissSendModal,
  openSendModal,
  stopSend,
  resumeSend,
  restartSend
} = useAdminCampaignSendFlow()
const sendControlBusy = ref(false)
const scheduleBusy = ref(false)
const resumeConfirmOpen = ref(false)
const restartConfirmOpen = ref(false)

const currentSendKey = computed(() =>
  adminCampaignKey({ tenantDbName: tenantDbName.value, id: id.value })
)

const cachedDetail = campaignStore.getCampaignDetailCache(tenantDbName.value, id.value)
const detailAsync = useAsyncData(
  () => `admin-campaign-${tenantDbName.value}-${id.value}`,
  async () => {
    const res = await marketingApi.fetchCampaignById(id.value)
    campaignStore.setCampaignDetailCache(tenantDbName.value, id.value, res.campaign)
    return res
  },
  cachedDetail ? { default: () => ({ campaign: cachedDetail }) } : {}
)
const mergeAsync = useAsyncData(
  () => `admin-email-merge-root-${tenantDbName.value}-${id.value}`,
  async () => ({
    mergeRoot: await marketingApi.fetchEmailMergeContextOrEmpty({ campaignId: id.value })
  })
)

const { data, error, pending, refresh } = detailAsync
const { data: mergeRootPayload } = mergeAsync

const campaign = computed((): TenantCampaignDetail | null => data.value?.campaign ?? null)

const isScheduledCampaign = computed(
  () => campaign.value?.status === 'Scheduled' && !!campaign.value?.scheduledAt
)

const campaignForSend = computed((): AdminCampaign | null => {
  const c = campaign.value
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    sender: c.sender,
    recipientsType: c.recipientsType,
    recipientsListId: c.recipientsListId,
    subject: c.subject,
    status: c.status,
    recipients: c.recipients ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    scheduledAt: c.scheduledAt,
    tenantDbName: tenantDbName.value,
    tenantName: ''
  }
})

const sendSuccessSummary = ref<{
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
} | null>(null)

async function onSendPollingComplete(res: { sent: number; failed: number; campaignStatus: string }) {
  const name = campaign.value?.name || 'campaign'
  await refresh()
  await campaignStore.fetchCampaigns()
  await nextTick()
  sendSuccessSummary.value = {
    campaignName: name,
    sent: res.sent,
    failed: res.failed,
    campaignStatus: res.campaignStatus
  }
}

async function handleStopSend() {
  const c = campaignForSend.value
  if (!c || !canStopSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    const ok = await stopSend(c)
    if (ok) await refresh()
  } finally {
    sendControlBusy.value = false
  }
}

function openResumeConfirm() {
  if (!campaignForSend.value || !canResumeSend(campaignForSend.value) || sendControlBusy.value) return
  resumeConfirmOpen.value = true
}

function openRestartConfirm() {
  if (!campaignForSend.value || !canRestartSend(campaignForSend.value) || sendControlBusy.value) return
  restartConfirmOpen.value = true
}

async function confirmResumeSend() {
  const c = campaignForSend.value
  if (!c || !canResumeSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    const { poll } = await resumeSend(c)
    resumeConfirmOpen.value = false
    if (!poll) return
    startSendStatusPolling(c, onSendPollingComplete)
    await refresh()
  } finally {
    sendControlBusy.value = false
  }
}

async function confirmRestartSend() {
  const c = campaignForSend.value
  if (!c || !canRestartSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    const { poll } = await restartSend(c)
    restartConfirmOpen.value = false
    if (!poll) return
    startSendStatusPolling(c, onSendPollingComplete)
    await refresh()
  } finally {
    sendControlBusy.value = false
  }
}

async function loadPausedProgress() {
  const c = campaign.value
  if (!c || (c.status !== 'Paused' && c.status !== 'Stopped')) return
  try {
    const res = await marketingApi.fetchSendCampaignStatus(id.value)
    campaignStore.setSendStatus({ ...res, campaignId: id.value })
  } catch {
    // ignore
  }
}

watch(
  () => campaign.value?.status,
  (status) => {
    if (status === 'Sending') tryResumeSendPolling()
    if (status === 'Paused' || status === 'Stopped') void loadPausedProgress()
  }
)

onMounted(() => {
  tryResumeSendPolling()
  void loadPausedProgress()
})

const sendProgressModalOpen = computed(() => sendingCampaignKey.value === currentSendKey.value)

const detailSendProgress = computed(() => buildCampaignSendProgress(sendStatus.value, id.value))

/** Inline live progress when modal is dismissed (send-now or scheduled background send). */
const showDetailSendProgress = computed(() => {
  if (sendProgressModalOpen.value) return false
  const status = campaign.value?.status
  if (status === 'Sending') return true
  if ((status === 'Paused' || status === 'Stopped') && detailSendProgress.value) return true
  return !!detailSendProgress.value && !detailSendProgress.value.done
})

const detailSendProgressLabel = computed(() => {
  const status = campaign.value?.status
  if (status === 'Paused') return 'Send paused'
  if (status === 'Stopped') return 'Send stopped'
  if ((campaignForSend.value && isSendPolling(campaignForSend.value)) || status === 'Sending') {
    return 'Send in progress'
  }
  return 'Scheduled send in progress'
})

function openDetailSendReport() {
  const c = campaignForSend.value
  if (c) openSendModal(c)
}

async function onSendModalControl(detail: {
  action: 'pause' | 'stop' | 'resume' | 'restart'
  poll?: boolean
}) {
  await refresh()
  const c = campaignForSend.value
  if ((detail.action === 'resume' || detail.action === 'restart') && detail.poll && c) {
    startSendStatusPolling(c, onSendPollingComplete)
  }
  if (detail.action === 'stop' || detail.action === 'pause') {
    void loadPausedProgress()
  }
}

function tryResumeSendPolling() {
  if (!import.meta.client) return
  if (campaign.value?.status !== 'Sending') return
  const c = campaignForSend.value
  if (!c) return
  if (isSendPolling(c)) return
  if (sendingCampaignKey.value === currentSendKey.value) return
  void resumeSendStatusPolling(c, onSendPollingComplete)
}

watch(
  () => data.value?.campaign?.status,
  () => {
    if (!pending.value) tryResumeSendPolling()
  }
)

function closeSendSuccessModal() {
  sendSuccessSummary.value = null
}

const sendModalCampaignName = computed(() =>
  sendingCampaignKey.value === currentSendKey.value ? campaign.value?.name || 'campaign' : 'campaign'
)

const mergeRoot = computed(() => mergeRootPayload.value?.mergeRoot ?? {})

const previewHtml = computed(() => {
  const raw = campaign.value?.templateHtml
  if (!raw) return ''
  return mergeMustacheTemplate(raw, mergeRoot.value)
})

const previewSubject = computed(() => {
  const sub = campaign.value?.subject
  if (!sub) return ''
  return mergeMustacheTemplate(sub, mergeRoot.value)
})
const previewTitle = computed(() => campaign.value?.name?.trim() || 'Campaign')
const previewSubjectDisplay = computed(() => previewSubject.value || campaign.value?.subject || 'No subject')

const showSkeleton = computed(
  () => !error.value && (pending.value || !campaign.value)
)

function formatDate(d: string) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatScheduledDateTime(iso: string) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function scheduleRemainingUntil(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = t - nowMs
  if (diff <= 0) return 'Send time reached'
  const minTotal = Math.floor(diff / 60000)
  const day = Math.floor(minTotal / 1440)
  const hr = Math.floor((minTotal % 1440) / 60)
  const min = minTotal % 60
  if (day >= 1) return `in ${day} day${day === 1 ? '' : 's'}`
  if (hr >= 1) return `in ${hr} hour${hr === 1 ? '' : 's'}${min > 0 ? ` ${min} min` : ''}`
  if (min >= 1) return `in ${min} min`
  return 'in less than a minute'
}

const countdownNow = ref(Date.now())
let countdownInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  countdownInterval = setInterval(() => {
    countdownNow.value = Date.now()
  }, 30000)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
  forceReleaseMarketingScrollLock()
})

async function handleUnschedule() {
  const c = campaign.value
  if (!c || c.status !== 'Scheduled') return
  scheduleBusy.value = true
  try {
    await marketingApi.unscheduleCampaignSend(c.id)
    const now = new Date().toISOString()
    if (data.value?.campaign) {
      data.value = {
        campaign: {
          ...data.value.campaign,
          status: 'Draft',
          scheduledAt: undefined,
          updatedAt: now
        }
      }
    }
    campaignStore.patchCampaignDetailCache(tenantDbName.value, c.id, {
      status: 'Draft',
      scheduledAt: undefined,
      updatedAt: now
    })
    const cached = campaignStore.getCampaignDetailCache(tenantDbName.value, c.id)
    if (cached) {
      campaignStore.upsertCampaignInList(
        campaignStore.listRowFromDetail(tenantDbName.value, '', cached)
      )
    }
    await refresh()
    await campaignStore.fetchCampaigns({ force: true })
  } finally {
    scheduleBusy.value = false
  }
}

type CampaignViewTab = 'details' | 'tracking'

function campaignViewTabFromQuery(view: unknown): CampaignViewTab | null {
  if (view === 'tracking') return 'tracking'
  if (view === 'details') return 'details'
  return null
}

const campaignViewTab = ref<CampaignViewTab>(
  campaignViewTabFromQuery(currentRoute.query.view) ?? 'details'
)

watch(
  () => currentRoute.query.view,
  (view) => {
    const tab = campaignViewTabFromQuery(view)
    if (tab) campaignViewTab.value = tab
  }
)

function setCampaignViewTab(tab: CampaignViewTab) {
  campaignViewTab.value = tab
  void navigateTo(
    { path: currentRoute.path, query: { ...currentRoute.query, view: tab } },
    { replace: true }
  )
}

const RECIPIENT_LIST_CAP = 100

const recipientDeliveryStats = computed(() => {
  const list = campaign.value?.recipients ?? []
  let pending = 0
  let sent = 0
  let failed = 0
  let aborted = 0
  for (const r of list) {
    if (r.status === 'pending') pending++
    else if (r.status === 'sent') sent++
    else if (r.status === 'failed') failed++
    else if (r.status === 'aborted' || r.status === 'cancelled') aborted++
  }
  return { pending, sent, failed, aborted, total: list.length }
})

const visibleRecipients = computed(() => {
  const list = campaign.value?.recipients ?? []
  return list.length > RECIPIENT_LIST_CAP ? list.slice(0, RECIPIENT_LIST_CAP) : list
})

const recipientListTruncated = computed(() => {
  const total = campaign.value?.recipients?.length ?? 0
  return total > RECIPIENT_LIST_CAP
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden antialiased">
    <div class="w-full min-w-0 space-y-6 sm:space-y-8">
      <NuxtLink
        to="/admin/campaigns"
        class="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-primary-700"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm shadow-slate-900/[0.04] transition group-hover:border-primary-200 group-hover:bg-primary-50/80 group-hover:text-primary-700">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        Back to campaigns
      </NuxtLink>

      <div
        v-if="error"
        class="mt-8 flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-sm"
        role="alert"
      >
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Campaign not found
      </div>

      <!-- Loading skeleton -->
      <div
        v-else-if="showSkeleton"
        class="mt-8 space-y-8 animate-pulse sm:space-y-10"
        aria-busy="true"
        aria-label="Loading campaign"
      >
        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 flex-1 space-y-4">
            <div class="flex gap-2">
              <div class="h-4 w-24 rounded-md bg-slate-200/90" />
              <div class="h-4 w-4 rounded bg-slate-200/90" />
              <div class="h-4 w-32 rounded-md bg-slate-200/90" />
            </div>
            <div class="h-9 max-w-xl rounded-xl bg-slate-200/90" />
            <div class="h-4 w-56 rounded-md bg-slate-200/90" />
          </div>
          <div class="flex shrink-0 gap-3">
            <div class="h-10 w-24 rounded-xl bg-slate-200/90" />
            <div class="h-10 w-28 rounded-full bg-slate-200/90" />
          </div>
        </header>

        <div class="flex flex-col gap-8 xl:grid xl:grid-cols-12 xl:items-start xl:gap-10 2xl:gap-12">
          <div class="min-w-0 space-y-8 xl:col-span-5 2xl:col-span-4">
            <div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10 xl:grid-cols-1 xl:gap-8">
              <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
                <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div class="h-3.5 w-24 rounded bg-slate-200/90" />
                </div>
                <div class="divide-y divide-slate-100 space-y-6 px-5 py-4 sm:px-6 sm:py-5">
                  <div v-for="n in 4" :key="n" class="grid gap-3 sm:grid-cols-3">
                    <div class="h-4 w-20 rounded bg-slate-200/90" />
                    <div class="h-4 rounded-lg bg-slate-200/90 sm:col-span-2" />
                  </div>
                </div>
              </div>
              <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
                <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div class="h-3.5 w-40 rounded bg-slate-200/90" />
                </div>
                <ul class="divide-y divide-slate-100 px-5 py-1 sm:px-6">
                  <li v-for="n in 5" :key="n" class="flex items-center justify-between gap-4 py-3.5">
                    <div class="h-4 max-w-[280px] flex-1 rounded bg-slate-200/90" />
                    <div class="h-6 w-14 shrink-0 rounded-full bg-slate-200/90" />
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="min-w-0 xl:col-span-7 2xl:col-span-8 xl:sticky xl:top-6 xl:self-start">
            <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
                <div class="h-3.5 w-32 rounded bg-slate-200/90" />
              </div>
              <div class="min-h-[400px] bg-slate-100/80 p-4 sm:p-6 xl:min-h-[min(55vh,480px)] 2xl:min-h-[min(60vh,560px)]">
                <div class="mx-auto h-full min-h-[360px] max-w-3xl rounded-xl bg-slate-200/90 2xl:max-w-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="campaign" class="mt-8 space-y-8 sm:space-y-10">
        <div
          v-if="sendError && !sendingCampaignKey"
          class="flex items-start gap-3.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-5 py-4 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <div class="mt-0.5 shrink-0 text-amber-600">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <span class="min-w-0 flex-1 leading-relaxed">{{ sendError }}</span>
          <button
            type="button"
            class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100/90"
            @click="closeSendModal()"
          >
            Dismiss
          </button>
        </div>

        <header class="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <nav class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <NuxtLink
                to="/admin/campaigns"
                class="font-semibold text-primary-600 transition-colors hover:text-primary-700"
                @click="campaignStore.fetchCampaigns()"
              >
                Campaigns
              </NuxtLink>
              <span class="text-slate-300" aria-hidden="true">/</span>
              <span class="truncate font-medium text-slate-700">{{ campaign.name }}</span>
            </nav>
            <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {{ campaign.name }}
            </h1>
            <p class="mt-2 text-sm text-slate-500 sm:text-[0.9375rem]">
              Created {{ formatDate(campaign.createdAt) }}
            </p>
            <div
              v-if="isScheduledCampaign && campaign.scheduledAt"
              class="mt-3 flex flex-col gap-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2.5 text-sm text-sky-950 shadow-sm ring-1 ring-sky-100/80 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pl-4"
            >
              <span class="flex min-w-0 items-center gap-2 font-medium">
                <svg class="h-4 w-4 shrink-0 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="tabular-nums">{{ formatScheduledDateTime(campaign.scheduledAt) }}</span>
              </span>
              <span class="shrink-0 text-sm font-semibold tabular-nums text-sky-800 sm:ml-auto">
                {{ scheduleRemainingUntil(campaign.scheduledAt, countdownNow) }}
              </span>
            </div>
            <ClientCampaignSendProgressBanner
              v-else-if="showDetailSendProgress && detailSendProgress"
              :progress="detailSendProgress"
              :label="detailSendProgressLabel"
              :status="campaign.status"
              clickable
              @open="openDetailSendReport"
            />
            <div
              v-else-if="showDetailSendProgress && campaign.status === 'Sending' && !detailSendProgress"
              class="mt-3 flex items-center gap-2 rounded-xl border border-primary-200/80 bg-primary-50/90 px-4 py-3 text-sm font-medium text-primary-950 shadow-sm ring-1 ring-primary-100/80"
              role="status"
              aria-live="polite"
            >
              <svg class="h-4 w-4 shrink-0 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending in progress — loading delivery stats…
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <button
              v-if="campaignForSend && canStopSend(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-red-200/90 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-950 shadow-sm transition-colors hover:bg-red-100/90 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="sendControlBusy"
              @click="handleStopSend"
            >
              Stop
            </button>
            <button
              v-if="campaignForSend && canResumeSend(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="sendControlBusy || !!sendingCampaignKey"
              @click="openResumeConfirm"
            >
              Resume
            </button>
            <button
              v-if="campaignForSend && canRestartSend(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="sendControlBusy || !!sendingCampaignKey"
              @click="openRestartConfirm"
            >
              Send again
            </button>
            <button
              v-if="isScheduledCampaign"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="scheduleBusy"
              title="Cancel scheduled send and return to draft"
              @click="handleUnschedule"
            >
              Cancel
            </button>
            <span
              class="inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset sm:px-4 sm:py-2 sm:text-[15px]"
              :class="{
                'bg-amber-50 text-amber-800 ring-amber-200/80': campaign.status === 'Draft',
                'bg-sky-50 text-sky-800 ring-sky-200/80': campaign.status === 'Scheduled' || campaign.status === 'Sending',
                'bg-violet-50 text-violet-800 ring-violet-200/80': campaign.status === 'Paused',
                'bg-orange-50 text-orange-800 ring-orange-200/80': campaign.status === 'Stopped',
                'bg-emerald-50 text-emerald-800 ring-emerald-200/80': campaign.status === 'Sent',
                'bg-red-50 text-red-800 ring-red-200/80': campaign.status === 'Failed',
                'bg-slate-100 text-slate-700 ring-slate-200/80': !['Draft','Scheduled','Sending','Sent','Failed'].includes(campaign.status)
              }"
            >
              {{ campaign.status }}
            </span>
          </div>
        </header>

        <nav
          class="flex gap-1 border-b border-slate-200/90"
          aria-label="Campaign views"
        >
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 sm:text-[15px]"
            :class="
              campaignViewTab === 'details'
                ? 'border-primary-600 text-primary-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            "
            :aria-current="campaignViewTab === 'details' ? 'page' : undefined"
            @click="setCampaignViewTab('details')"
          >
            Details
          </button>
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 sm:text-[15px]"
            :class="
              campaignViewTab === 'tracking'
                ? 'border-primary-600 text-primary-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            "
            :aria-current="campaignViewTab === 'tracking' ? 'page' : undefined"
            @click="setCampaignViewTab('tracking')"
          >
            Tracking
          </button>
        </nav>

        <div
          v-if="campaignViewTab === 'details'"
          class="flex flex-col gap-6 sm:gap-8 xl:grid xl:grid-cols-12 xl:items-start xl:gap-10 2xl:gap-12"
        >
          <div class="min-w-0 space-y-8 xl:col-span-5 2xl:col-span-4 xl:space-y-8">
            <div
              class="grid grid-cols-1 gap-8 lg:gap-10 xl:gap-8"
              :class="{
                'lg:grid-cols-2 xl:grid-cols-1':
                  campaign.recipients?.length &&
                  (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list')
              }"
            >
              <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
                <div class="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Overview
                  </h2>
                </div>
                <dl class="divide-y divide-slate-100">
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-slate-500 sm:text-[15px]">Sender</dt>
                    <dd class="break-words text-sm text-slate-900 sm:col-span-2 sm:text-[15px]">
                      {{ CONTACT_OWNER_SENDER_LABEL }} &lt;{{ campaign.sender?.email }}&gt;
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-slate-500 sm:text-[15px]">Subject</dt>
                    <dd class="break-words text-sm text-slate-900 sm:col-span-2 sm:text-[15px]">
                      {{ previewSubject || '–' }}
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-slate-500 sm:text-[15px]">Recipients</dt>
                    <dd class="text-sm text-slate-900 sm:col-span-2 sm:text-[15px]">
                      <span v-if="campaign.recipientsType === 'manual'">
                        {{ campaign.recipients?.length ?? 0 }} manual recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }}
                      </span>
                      <span v-else-if="campaign.recipientsType === 'list'">
                        {{ campaign.recipients?.length ?? 0 }} recipient{{ (campaign.recipients?.length ?? 0) === 1 ? '' : 's' }} from list
                      </span>
                      <span v-else>–</span>
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
                    <dt class="text-sm font-medium text-slate-500 sm:text-[15px]">Updated</dt>
                    <dd class="text-sm text-slate-900 sm:col-span-2 sm:text-[15px]">
                      {{ formatDate(campaign.updatedAt) }}
                    </dd>
                  </div>
                  <div
                    v-if="isScheduledCampaign && campaign.scheduledAt"
                    class="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5"
                  >
                    <dt class="text-sm font-medium text-slate-500 sm:text-[15px]">Scheduled send</dt>
                    <dd class="space-y-1 text-sm sm:col-span-2 sm:text-[15px]">
                      <div class="font-medium tabular-nums text-slate-900">
                        {{ formatScheduledDateTime(campaign.scheduledAt) }}
                      </div>
                      <div class="font-semibold tabular-nums text-sky-800">
                        {{ scheduleRemainingUntil(campaign.scheduledAt, countdownNow) }}
                      </div>
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                v-if="
                  campaign.recipients?.length &&
                  (campaign.recipientsType === 'manual' || campaign.recipientsType === 'list')
                "
                class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
              >
                <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Recipients ({{ campaign.recipients.length }})
                  </h2>
                  <div
                    v-if="campaign.recipients.some(r => r.status)"
                    class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:text-sm"
                  >
                    <span class="text-amber-700">Pending: {{ recipientDeliveryStats.pending }}</span>
                    <span class="text-emerald-700">Sent: {{ recipientDeliveryStats.sent }}</span>
                    <span class="text-red-700">Failed: {{ recipientDeliveryStats.failed }}</span>
                    <span class="text-slate-600">Aborted: {{ recipientDeliveryStats.aborted }}</span>
                  </div>
                </div>
                <p
                  v-if="recipientListTruncated"
                  class="border-b border-slate-100 px-5 py-2 text-xs text-slate-500 sm:px-6"
                >
                  Showing first {{ RECIPIENT_LIST_CAP }} of {{ recipientDeliveryStats.total }} recipients.
                </p>
                <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto xl:max-h-[min(52vh,28rem)]">
                  <li
                    v-for="(r, i) in visibleRecipients"
                    :key="i"
                    class="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80 sm:px-6"
                  >
                    <div class="min-w-0 flex-1">
                      <span class="text-sm text-slate-900 sm:text-[15px]">{{ r.email }}</span>
                      <p
                        v-if="r.status === 'failed' && r.error"
                        class="mt-1 truncate text-sm text-red-600"
                        :title="r.error"
                      >
                        {{ r.error }}
                      </p>
                    </div>
                    <span
                      v-if="r.status"
                      class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 sm:px-3 sm:py-1 sm:text-sm"
                      :class="{
                        'bg-amber-50 text-amber-800 ring-amber-200/70': r.status === 'pending',
                        'bg-emerald-50 text-emerald-800 ring-emerald-200/70': r.status === 'sent',
                        'bg-red-50 text-red-800 ring-red-200/70': r.status === 'failed',
                        'bg-slate-100 text-slate-700 ring-slate-200/70': r.status === 'aborted' || r.status === 'cancelled'
                      }"
                    >
                      {{ r.status === 'cancelled' ? 'aborted' : r.status }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="min-w-0 xl:col-span-7 2xl:col-span-8">
            <TenantCampaignEmailPreview
              v-if="campaign.templateHtml"
              :html="previewHtml"
              :thumbnail-html="campaign.templateHtml"
              :title="previewTitle"
              :subject="previewSubjectDisplay"
              summary="Preview with merge tags applied from your recipients."
            />

            <div
              v-else
              class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center shadow-sm shadow-slate-900/[0.02] sm:px-8 sm:py-12"
            >
              <p class="text-sm text-slate-500 sm:text-[0.9375rem]">No email template</p>
            </div>
          </div>
        </div>

        <section
          v-if="campaignViewTab === 'tracking'"
          class="min-w-0 space-y-4 sm:space-y-6"
          aria-label="Campaign send tracking"
        >
          <TenantBrevoTrackingEventsPanel
            :key="`campaign-tracking-${id}`"
            :campaign-id="id"
            :admin-tenant-db="tenantDbName"
            hide-campaign-column
            panel-hint="Delivery, opens, and clicks for this campaign."
          />
        </section>
      </div>
    </div>

    <ClientSendProgressModal
      :open="sendProgressModalOpen"
      :campaign-id="id"
      :campaign-name="sendModalCampaignName"
      :admin-tenant-db="tenantDbName"
      :send-error="sendError"
      :send-progress="detailSendProgress ?? sendProgress"
      @close="dismissSendModal"
      @send-control="onSendModalControl"
    />

    <ClientConfirmationModal
      :open="resumeConfirmOpen"
      title="Resume send?"
      message="Continue sending only to remaining pending recipients. People who already received this campaign will not be emailed again."
      confirm-text="Resume"
      variant="primary"
      :confirm-loading="sendControlBusy"
      @confirm="confirmResumeSend"
      @cancel="resumeConfirmOpen = false"
    />

    <ClientConfirmationModal
      :open="restartConfirmOpen"
      title="Send again?"
      message="Start over and send this campaign again to everyone, including recipients who already received it."
      confirm-text="Send again"
      variant="primary"
      :confirm-loading="sendControlBusy"
      @confirm="confirmRestartSend"
      @cancel="restartConfirmOpen = false"
    />

    <ClientSendSuccessModal
      :open="!!sendSuccessSummary"
      :campaign-name="sendSuccessSummary?.campaignName ?? ''"
      :sent="sendSuccessSummary?.sent ?? 0"
      :failed="sendSuccessSummary?.failed ?? 0"
      :campaign-status="sendSuccessSummary?.campaignStatus ?? ''"
      @close="closeSendSuccessModal"
    />
  </div>
</template>
