<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Campaign, CampaignSendRecipientReport } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'
import type { TenantCampaignDetail } from '~/composables/useTenantMarketingApi'
import { mergeMustacheTemplate } from '~~/shared/utils/emailTemplateMerge'
import { canDuplicateCampaign, duplicateModalMessage } from '~/utils/campaignActionRules'
import { formatScheduledDateTime, scheduleRemainingUntil } from '~/utils/campaignDisplay'

const route = useRoute()
const campaignStore = useCampaignStore()
const { sendingCampaignId, sendError, sendStatus } = storeToRefs(campaignStore)
const marketingApi = useTenantMarketingApi()
const {
  canSendDraft,
  canScheduleDraft,
  canResumeSchedule,
  canScheduleAgainCampaign,
  canResumeSend,
  canResumeUnsentOnly,
  canSendAgainCampaign,
  canSendAgainWhilePaused,
  canDiscardPaused,
  canStopSending,
  sendProgress,
  buildCampaignSendProgress,
  resumeSendStatusPolling,
  stopSendPolling,
  isSendPolling,
  closeSendModal,
  openSendModal
} = useCampaignSendFlow()
const id = route.params.id as string

const cachedDetail = campaignStore.getCampaignDetailCache(id)
const detailAsync = useAsyncData(
  `tenant-campaign-${id}`,
  async () => {
    const res = await marketingApi.fetchCampaignById(id)
    campaignStore.setCampaignDetailCache(id, res.campaign)
    return res
  },
  cachedDetail ? { default: () => ({ campaign: cachedDetail }) } : {}
)
const mergeAsync = useAsyncData(`email-merge-root-${id}`, async () => ({
  mergeRoot: await marketingApi.fetchEmailMergeContextOrEmpty({ campaignId: id })
}))

const { data, error, pending, refresh } = detailAsync
const { data: mergeRootPayload } = mergeAsync

const campaign = computed((): TenantCampaignDetail | null => data.value?.campaign ?? null)

const campaignForSend = computed((): Campaign | null => {
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
    recipientCount: c.recipientCount,
    recipientStatusCounts: c.recipientStatusCounts,
    recipients: c.recipients ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    scheduledAt: c.scheduledAt
  }
})

const recipientPage = ref(1)
const RECIPIENT_PAGE_SIZE = 50
const recipientReport = ref<CampaignSendRecipientReport | null>(null)
const recipientReportLoading = ref(false)
const recipientReportError = ref('')

const recipientDisplayCount = computed(() => {
  const c = campaign.value
  return c?.recipientStatusCounts?.total ?? c?.recipientCount ?? 0
})

const showRecipientList = computed(() => {
  const c = campaign.value
  if (!c) return false
  if (c.status === 'Draft' || c.status === 'Scheduled') return false
  return recipientDisplayCount.value > 0
})

const recipientStatusCounts = computed(
  () => recipientReport.value?.counts ?? campaign.value?.recipientStatusCounts ?? null
)

async function loadRecipientReport() {
  if (!showRecipientList.value) {
    recipientReport.value = null
    return
  }
  recipientReportLoading.value = true
  recipientReportError.value = ''
  try {
    recipientReport.value = await marketingApi.fetchCampaignSendRecipients(id, {
      page: recipientPage.value,
      limit: RECIPIENT_PAGE_SIZE
    })
  } catch (e: unknown) {
    recipientReport.value = null
    recipientReportError.value =
      e instanceof Error ? e.message : 'Could not load recipients.'
  } finally {
    recipientReportLoading.value = false
  }
}

watch(showRecipientList, (show) => {
  if (show) void loadRecipientReport()
  else recipientReport.value = null
}, { immediate: true })

watch(recipientPage, () => {
  if (showRecipientList.value) void loadRecipientReport()
})

watch(
  () => campaign.value?.recipientStatusCounts?.total,
  () => {
    if (showRecipientList.value) void loadRecipientReport()
  }
)

const { countdownNow } = useCampaignCountdown()

const {
  sendSuccessSummary,
  sendDraft,
  resumeSend,
  resumeUnsentOnly,
  sendAgain,
  closeSendSuccessModal
} = useTenantCampaignSendActions({
  getCampaignName: () => campaign.value?.name || 'campaign',
  onPollingComplete: async () => {
    await refresh()
    await campaignStore.fetchCampaigns()
  }
})

const { handleSendModalClose } = useTenantSendModalClose(async () => {
  await refresh()
})

const {
  open: scheduleOpen,
  scheduleLocal,
  scheduleError,
  scheduleBusy,
  title: scheduleTitle,
  description: scheduleDescription,
  openWithMode: openScheduleModal,
  close: closeScheduleModal,
  confirm: confirmSchedule,
  unschedule: unscheduleCampaign
} = useTenantCampaignSchedule({
  getCampaign: () => campaignForSend.value,
  onScheduled: async () => {
    await refresh()
    await campaignStore.fetchCampaigns()
  }
})

const sendAgainConfirmOpen = ref(false)
const sendAgainBusy = ref(false)
const discardConfirmOpen = ref(false)
const discardBusy = ref(false)
const duplicateConfirmOpen = ref(false)
const duplicateConfirmLoading = ref(false)

const {
  open: testEmailModalOpen,
  recipient: testEmailRecipient,
  sending: testEmailSending,
  error: testEmailError,
  successModalOpen: testEmailSuccessModalOpen,
  sentToRecipient: testEmailSentToRecipient,
  openModal: openTestEmailModal,
  closeModal: closeTestEmailModal,
  closeSuccessModal: closeTestEmailSuccessModal,
  sendForCampaign: sendTestEmailForCampaign
} = useCampaignTestEmail()

const canSendTestEmail = computed(
  () => !!campaign.value?.templateHtml?.trim() && !!campaign.value?.subject?.trim()
)

function handleOpenTestEmailModal() {
  openTestEmailModal(campaign.value?.sender?.email)
}

async function submitTestEmail() {
  if (!campaign.value?.id) return
  await sendTestEmailForCampaign(campaign.value.id)
}

const canStopCurrentSend = computed(() =>
  campaign.value?.status === 'Sending' &&
  canStopSending(detailSendProgress.value ?? sendProgress.value, campaign.value?.status)
)

function handleStopSend() {
  openSendModal(id)
}

async function handleResumeUnsentOnly() {
  const c = campaignForSend.value
  if (!c || !canResumeUnsentOnly(c)) return
  await resumeUnsentOnly(c)
}

async function handleSendAgainWhilePaused() {
  const c = campaignForSend.value
  if (!c || !canSendAgainWhilePaused(c) || sendAgainBusy.value) return
  sendAgainBusy.value = true
  try {
    await sendAgain(c)
    sendAgainConfirmOpen.value = false
  } finally {
    sendAgainBusy.value = false
  }
}

async function handleDiscardPaused() {
  if (discardBusy.value) return
  discardBusy.value = true
  try {
    await campaignStore.discardPausedCampaign(id)
    discardConfirmOpen.value = false
    await refresh()
  } finally {
    discardBusy.value = false
  }
}

function openDuplicateModal() {
  duplicateConfirmOpen.value = true
}

async function confirmDuplicate() {
  const c = campaignForSend.value
  if (!c || !canDuplicateCampaign(c) || duplicateConfirmLoading.value) return
  duplicateConfirmLoading.value = true
  try {
    const newId = await campaignStore.duplicateCampaign(c)
    duplicateConfirmOpen.value = false
    if (newId) await navigateTo(`/tenant/campaigns/edit/${newId}`)
  } finally {
    duplicateConfirmLoading.value = false
  }
}

async function handleSend() {
  const c = campaignForSend.value
  if (!c || !canSendDraft(c)) return
  await sendDraft(c)
}

async function handleResumeSend() {
  const c = campaignForSend.value
  if (!c || !canResumeSend(c)) return
  await resumeSend(c)
}

async function handleSendAgain() {
  const c = campaignForSend.value
  if (!c || !canSendAgainCampaign(c) || sendAgainBusy.value) return
  sendAgainBusy.value = true
  try {
    await sendAgain(c)
    sendAgainConfirmOpen.value = false
  } finally {
    sendAgainBusy.value = false
  }
}

const detailSendProgress = computed(() => buildCampaignSendProgress(sendStatus.value, id))

const sendProgressModalOpen = computed(() => sendingCampaignId.value === id)

/** Inline live progress when modal is dismissed (send-now or scheduled background send). */
const showDetailSendProgress = computed(() => {
  if (sendProgressModalOpen.value) return false
  return (
    campaign.value?.status === 'Sending' ||
    (!!detailSendProgress.value && !detailSendProgress.value.done)
  )
})

const detailSendProgressLabel = computed(() => {
  if (isSendPolling(id) || campaign.value?.status === 'Sending') return 'Send in progress'
  return 'Scheduled send in progress'
})

function openDetailSendReport() {
  openSendModal(id)
}

function tryResumeSendPolling() {
  if (!import.meta.client) return
  if (campaign.value?.status !== 'Sending') return
  if (isSendPolling(id)) return
  if (sendingCampaignId.value === id) return
  void resumeSendStatusPolling(id, async (res) => {
    await refresh()
    await campaignStore.fetchCampaigns()
    await nextTick()
    sendSuccessSummary.value = {
      campaignName: campaign.value?.name || 'campaign',
      sent: res.sent,
      failed: res.failed,
      campaignStatus: res.campaignStatus
    }
  })
}

watch(
  () => campaign.value?.status,
  (status) => {
    if (status === 'Sending') tryResumeSendPolling()
  }
)

watch(
  () => data.value?.campaign?.status,
  () => {
    if (!pending.value) tryResumeSendPolling()
  }
)

onMounted(() => {
  tryResumeSendPolling()
})

const sendModalCampaignName = computed(() =>
  sendingCampaignId.value === id ? campaign.value?.name || 'campaign' : 'campaign'
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
  () =>
    !error.value &&
    pending.value
)

function previewSrcdoc(html: string, scale = 0.45) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:32px 16px;overflow:auto;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:center top;width:600px}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}

/** Larger scale for modal for better readability. */
function previewSrcdocModal(html: string, scale = 1) {
  return previewSrcdoc(html, scale)
}

const previewModalOpen = ref(false)

function openPreviewModal() {
  previewModalOpen.value = true
}

function closePreviewModal() {
  previewModalOpen.value = false
}

let previewEscListener: ((e: KeyboardEvent) => void) | null = null

watch(previewModalOpen, (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (previewEscListener) {
    window.removeEventListener('keydown', previewEscListener)
    previewEscListener = null
  }
  if (open) {
    previewEscListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreviewModal()
    }
    window.addEventListener('keydown', previewEscListener)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  if (previewEscListener) {
    window.removeEventListener('keydown', previewEscListener)
    previewEscListener = null
  }
  if (isSendPolling(id) && sendingCampaignId.value !== id) {
    stopSendPolling()
  }
})

function formatDate(d: string) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function handleUnschedule() {
  const c = campaignForSend.value
  if (!c) return
  await unscheduleCampaign(c)
}

const { campaignViewTab, trackingSessionKey } = useCampaignTrackingTab('details')
</script>

<template>
  <div class="w-full min-w-0 antialiased">
    <div class="w-full min-w-0">
      <NuxtLink
        to="/tenant/campaigns"
        class="group inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-indigo-700"
        @click="campaignStore.fetchCampaigns()"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm shadow-slate-900/[0.04] transition group-hover:border-indigo-200 group-hover:bg-indigo-50/80 group-hover:text-indigo-700">
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
          v-if="sendError && !sendingCampaignId"
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
                to="/tenant/campaigns"
                class="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
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
              v-if="campaign.status === 'Scheduled' && campaign.scheduledAt"
              class="mt-3 flex flex-col gap-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2.5 text-sm text-sky-950 shadow-sm ring-1 ring-sky-100/80 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pl-4"
            >
              <span class="flex items-center gap-2 min-w-0 font-medium">
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
              clickable
              @open="openDetailSendReport"
            />
            <div
              v-else-if="showDetailSendProgress && campaign.status === 'Sending' && !detailSendProgress"
              class="mt-3 flex items-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3 text-sm font-medium text-indigo-950 shadow-sm ring-1 ring-indigo-100/80"
              role="status"
              aria-live="polite"
            >
              <svg class="h-4 w-4 shrink-0 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending in progress — loading delivery stats…
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <button
              v-if="campaignForSend && canSendDraft(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="handleSend"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Send campaign
            </button>
            <button
              v-if="campaignForSend && canResumeSend(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-sky-50/90 px-4 py-2.5 text-sm font-semibold text-sky-900 shadow-sm transition-colors hover:bg-sky-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="handleResumeSend"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Resume send
            </button>
            <button
              v-if="campaignForSend && canResumeUnsentOnly(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="handleResumeUnsentOnly"
            >
              Resume unsent only
            </button>
            <button
              v-if="campaignForSend && canResumeSchedule(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-violet-200/90 bg-violet-50/90 px-4 py-2.5 text-sm font-semibold text-violet-900 shadow-sm transition-colors hover:bg-violet-100/90 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="openScheduleModal('resume')"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Resume schedule
            </button>
            <button
              v-if="campaignForSend && canSendAgainCampaign(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="sendAgainConfirmOpen = true"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Send again
            </button>
            <button
              v-if="campaignForSend && canScheduleDraft(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="openScheduleModal('new')"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Schedule send
            </button>
            <button
              v-if="campaignForSend && canScheduleAgainCampaign(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="openScheduleModal('resend_all')"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Schedule again
            </button>
            <button
              v-if="campaignForSend && canSendAgainWhilePaused(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="!!sendingCampaignId || scheduleBusy"
              @click="sendAgainConfirmOpen = true"
            >
              Send to all again
            </button>
            <button
              v-if="campaignForSend && canDiscardPaused(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50/90 px-4 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition-colors hover:bg-rose-100/90 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="discardBusy"
              @click="discardConfirmOpen = true"
            >
              Cancel permanently
            </button>
            <button
              v-if="canStopCurrentSend"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-300/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              @click="handleStopSend"
            >
              Stop send
            </button>
            <button
              v-if="campaign?.status === 'Scheduled'"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="scheduleBusy"
              @click="handleUnschedule"
            >
              Cancel schedule
            </button>
            <NuxtLink
              v-if="campaign.status === 'Draft' || campaign.status === 'Failed' || campaign.status === 'Scheduled'"
              :to="`/tenant/campaigns/edit/${campaign.id}`"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 sm:text-[15px]"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </NuxtLink>
            <button
              v-if="campaignForSend && canDuplicateCampaign(campaignForSend)"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]"
              :disabled="duplicateConfirmLoading"
              @click="openDuplicateModal"
            >
              <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate
            </button>
            <span
              class="inline-flex rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset sm:px-4 sm:py-2 sm:text-[15px]"
              :class="{
                'bg-amber-50 text-amber-800 ring-amber-200/80': campaign.status === 'Draft',
                'bg-sky-50 text-sky-800 ring-sky-200/80': campaign.status === 'Scheduled' || campaign.status === 'Sending',
                'bg-emerald-50 text-emerald-800 ring-emerald-200/80': campaign.status === 'Sent',
                'bg-red-50 text-red-800 ring-red-200/80': campaign.status === 'Failed',
                'bg-amber-50 text-amber-900 ring-amber-200/80': campaign.status === 'Paused',
                'bg-rose-50 text-rose-800 ring-rose-200/80': campaign.status === 'Cancelled',
                'bg-slate-100 text-slate-700 ring-slate-200/80': !['Draft','Scheduled','Sending','Paused','Sent','Failed','Cancelled'].includes(campaign.status)
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
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            "
            :aria-current="campaignViewTab === 'details' ? 'page' : undefined"
            @click="campaignViewTab = 'details'"
          >
            Details
          </button>
          <button
            type="button"
            class="-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 sm:text-[15px]"
            :class="
              campaignViewTab === 'tracking'
                ? 'border-indigo-600 text-indigo-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            "
            :aria-current="campaignViewTab === 'tracking' ? 'page' : undefined"
            @click="campaignViewTab = 'tracking'"
          >
            Tracking
          </button>
        </nav>

        <div
          v-show="campaignViewTab === 'details'"
          class="flex flex-col gap-8 sm:gap-10 xl:grid xl:grid-cols-12 xl:items-start xl:gap-10 2xl:gap-12"
        >
          <div class="min-w-0 space-y-8 xl:col-span-5 2xl:col-span-4 xl:space-y-8">
            <div
              class="grid grid-cols-1 gap-8 lg:gap-10 xl:gap-8"
              :class="{
                'lg:grid-cols-2 xl:grid-cols-1':
                  showRecipientList &&
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
                      {{ campaign.sender?.name }} &lt;{{ campaign.sender?.email }}&gt;
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
                        {{ recipientDisplayCount.toLocaleString() }} manual recipient{{ recipientDisplayCount === 1 ? '' : 's' }}
                      </span>
                      <span v-else-if="campaign.recipientsType === 'list'">
                        {{ recipientDisplayCount.toLocaleString() }} recipient{{ recipientDisplayCount === 1 ? '' : 's' }} from list
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
                    v-if="campaign.status === 'Scheduled' && campaign.scheduledAt"
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
                v-if="showRecipientList"
                class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
              >
                <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Recipients ({{ recipientDisplayCount.toLocaleString() }})
                  </h2>
                  <div
                    v-if="recipientStatusCounts"
                    class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:text-sm"
                  >
                    <span class="text-amber-700">Pending: {{ recipientStatusCounts.pending.toLocaleString() }}</span>
                    <span class="text-sky-700">In flight: {{ recipientStatusCounts.sending.toLocaleString() }}</span>
                    <span class="text-emerald-700">Sent: {{ recipientStatusCounts.sent.toLocaleString() }}</span>
                    <span class="text-red-700">Failed: {{ recipientStatusCounts.failed.toLocaleString() }}</span>
                    <span class="text-slate-600">Cancelled: {{ recipientStatusCounts.cancelled.toLocaleString() }}</span>
                  </div>
                </div>
                <div
                  v-if="recipientReportLoading && !recipientReport?.items.length"
                  class="px-5 py-8 text-center text-sm text-slate-500 sm:px-6"
                  aria-busy="true"
                >
                  Loading recipients…
                </div>
                <p
                  v-else-if="recipientReportError"
                  class="px-5 py-6 text-sm text-red-700 sm:px-6"
                  role="alert"
                >
                  {{ recipientReportError }}
                </p>
                <template v-else-if="recipientReport">
                  <ul class="max-h-80 divide-y divide-slate-100 overflow-y-auto xl:max-h-[min(52vh,28rem)]">
                    <li
                      v-for="(r, i) in recipientReport.items"
                      :key="`${r.email}-${i}`"
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
                          'bg-sky-50 text-sky-800 ring-sky-200/70': r.status === 'sending',
                          'bg-emerald-50 text-emerald-800 ring-emerald-200/70': r.status === 'sent',
                          'bg-red-50 text-red-800 ring-red-200/70': r.status === 'failed',
                          'bg-slate-100 text-slate-700 ring-slate-200/70': r.status === 'cancelled'
                        }"
                      >
                        {{ r.status }}
                      </span>
                    </li>
                  </ul>
                  <div
                    v-if="recipientReport.totalPages > 1"
                    class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600 sm:px-6"
                  >
                    <span class="tabular-nums">
                      Page {{ recipientReport.page }} / {{ recipientReport.totalPages }}
                    </span>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                        :disabled="recipientPage <= 1 || recipientReportLoading"
                        @click="recipientPage -= 1"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                        :disabled="recipientPage >= recipientReport.totalPages || recipientReportLoading"
                        @click="recipientPage += 1"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="min-w-0 xl:col-span-7 2xl:col-span-8 xl:sticky xl:top-6 xl:self-start">
            <div v-if="campaign.templateHtml" class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div class="min-w-0">
                  <h2 class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {{ previewTitle }}
                  </h2>
                  <p class="mt-1 truncate text-sm text-slate-600" :title="previewSubjectDisplay">
                    Subject: {{ previewSubjectDisplay }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-if="canSendTestEmail"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-violet-200/90 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm shadow-violet-900/[0.04] ring-1 ring-violet-100/80 transition-colors hover:bg-violet-100/90"
                    @click="handleOpenTestEmailModal"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send test email
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800"
                    @click="openPreviewModal"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Full preview
                  </button>
                </div>
              </div>
              <div
                class="relative min-h-[400px] max-h-[600px] cursor-zoom-in overflow-auto bg-[#f8f4ef] p-4 sm:p-6 xl:min-h-[min(52vh,560px)] xl:max-h-[min(88vh,920px)] 2xl:min-h-[min(58vh,640px)]"
                role="button"
                tabindex="0"
                :aria-label="'Open full email preview. Subject: ' + (previewSubject || campaign.name)"
                @click="openPreviewModal"
                @keydown.enter.prevent="openPreviewModal"
                @keydown.space.prevent="openPreviewModal"
              >
                <iframe
                  :srcdoc="previewSrcdoc(previewHtml)"
                  title="Email preview"
                  class="pointer-events-none min-h-[400px] w-full select-none border-0 xl:min-h-[min(48vh,520px)]"
                  sandbox="allow-same-origin"
                />
                <p class="pointer-events-none mt-3 text-center text-xs text-slate-500">
                  Click to open full preview
                </p>
              </div>
            </div>

            <div
              v-else
              class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center shadow-sm shadow-slate-900/[0.02] sm:px-8 sm:py-12 xl:py-16"
            >
              <p class="text-sm text-slate-500 sm:text-[0.9375rem]">No email template</p>
            </div>
          </div>
        </div>

        <section
          v-if="campaignViewTab === 'tracking'"
          :key="trackingSessionKey"
          class="min-w-0 space-y-8 pt-2"
          aria-label="Campaign send tracking"
        >
          <TenantCampaignTrackingAnalytics :campaign-id="id" />
          <CampaignTrackingEventsTable :campaign-id="id" />
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="previewModalOpen && previewHtml"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 lg:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-preview-modal-title"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="closePreviewModal"
        />
        <div
          class="relative flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:h-[92vh] sm:rounded-2xl"
        >
          <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div class="min-w-0">
              <p id="email-preview-modal-title" class="text-base font-semibold text-slate-900 sm:text-lg">
                {{ previewTitle }}
              </p>
              <p class="mt-1 truncate text-sm text-slate-600 sm:text-base" :title="previewSubjectDisplay">
                Subject: {{ previewSubjectDisplay }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close preview"
              @click="closePreviewModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-auto bg-[#f8f4ef] p-3 sm:p-4 lg:p-5">
            <iframe
              :srcdoc="previewSrcdocModal(previewHtml)"
              class="h-full w-full min-h-[420px] border-0"
              sandbox="allow-same-origin"
              title="Email preview (full size)"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <ClientSendProgressModal
      :open="sendProgressModalOpen"
      :campaign-id="id"
      :campaign-name="sendModalCampaignName"
      :send-error="sendError"
      :send-progress="detailSendProgress ?? sendProgress"
      @close="handleSendModalClose"
    />

    <ClientSendSuccessModal
      :open="!!sendSuccessSummary"
      :campaign-name="sendSuccessSummary?.campaignName ?? ''"
      :sent="sendSuccessSummary?.sent ?? 0"
      :failed="sendSuccessSummary?.failed ?? 0"
      :campaign-status="sendSuccessSummary?.campaignStatus ?? ''"
      @close="closeSendSuccessModal"
    />

    <ClientConfirmationModal
      :open="discardConfirmOpen"
      title="Cancel this paused send?"
      message="The campaign will move to Cancelled. You can send to everyone again, but you will no longer resume from where you left off."
      confirm-text="Cancel permanently"
      variant="danger"
      :confirm-loading="discardBusy"
      @confirm="handleDiscardPaused"
      @cancel="discardConfirmOpen = false"
    />

    <ClientConfirmationModal
      :open="sendAgainConfirmOpen"
      title="Send again to all recipients?"
      message="This will email everyone on the audience again, including people who already received it. They may get duplicate emails."
      confirm-text="Send again"
      variant="danger"
      :confirm-loading="sendAgainBusy"
      @confirm="campaignForSend?.status === 'Paused' ? handleSendAgainWhilePaused() : handleSendAgain()"
      @cancel="sendAgainConfirmOpen = false"
    />

    <ClientConfirmationModal
      :open="duplicateConfirmOpen"
      title="Duplicate campaign"
      :message="duplicateModalMessage(campaignForSend)"
      confirm-text="Duplicate"
      :confirm-loading="duplicateConfirmLoading"
      @confirm="confirmDuplicate"
      @cancel="duplicateConfirmOpen = false"
    />

    <TenantCampaignScheduleModal
      :open="scheduleOpen"
      :title="scheduleTitle"
      :description="scheduleDescription"
      :schedule-local="scheduleLocal"
      :schedule-error="scheduleError"
      :schedule-busy="scheduleBusy"
      title-id="schedule-send-title"
      input-id="schedule-datetime"
      @update:schedule-local="scheduleLocal = $event"
      @close="closeScheduleModal"
      @confirm="confirmSchedule"
    />

    <ClientTestEmailModal
      :open="testEmailModalOpen"
      :recipient="testEmailRecipient"
      :sending="testEmailSending"
      :error="testEmailError"
      @update:recipient="testEmailRecipient = $event"
      @close="closeTestEmailModal()"
      @send="submitTestEmail()"
    />

    <ClientTestEmailSuccessModal
      :open="testEmailSuccessModalOpen"
      :recipient="testEmailSentToRecipient"
      @close="closeTestEmailSuccessModal()"
    />
  </div>
</template>
