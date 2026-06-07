<script setup lang="ts">
import type { Campaign } from '~/types/campaign'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '~/store/campaignStore'
import {
  canOpenSendAgainModal,
  discardPausedModalMessage,
  duplicateModalMessage,
  sendAgainModalMessage,
  sendAgainModalTitle
} from '~/utils/campaignActionRules'
import {
  canDiscardPaused,
  canResumeSend,
  canResumeUnsentOnly,
  canSendDraft
} from '~/utils/campaignSendRules'
import { campaignSubtitle } from '~/utils/campaignDisplay'
import type { CampaignScheduleMode } from '~/utils/campaignScheduleCopy'

const store = useCampaignStore()
const { campaigns, sendingCampaignId, sendError } = storeToRefs(store)
const { sendProgress, closeSendModal } = useCampaignSendFlow()
const { countdownNow } = useCampaignCountdown()

const {
  sendSuccessSummary,
  sendDraft,
  resumeSend,
  resumeUnsentOnly,
  sendAgain,
  openStopSendModal,
  closeSendSuccessModal
} = useTenantCampaignSendActions({
  getCampaignName: (id) => campaigns.value.find((x) => x.id === id)?.name || 'campaign'
})

const { handleSendModalClose } = useTenantSendModalClose(() => {
  void store.fetchCampaigns()
})

const {
  open: scheduleOpen,
  scheduleLocal,
  scheduleError,
  scheduleBusy,
  title: scheduleTitle,
  description: scheduleDescription,
  displayCampaign: scheduleCampaign,
  openFor: openScheduleForCampaign,
  close: closeScheduleModal,
  confirm: confirmSchedule,
  unschedule: unscheduleCampaign
} = useTenantCampaignSchedule({
  onScheduled: () => {
    void store.fetchCampaigns()
  }
})

const searchQuery = ref('')
const statusFilter = ref<string>('all')
const campaignToDelete = ref<Campaign | null>(null)
const campaignToDuplicate = ref<Campaign | null>(null)
const currentPage = ref(1)
const PAGE_SIZE = 10

const deleteModalMessage = computed(() =>
  campaignToDelete.value
    ? `Are you sure you want to delete "${campaignToDelete.value.name || 'Untitled'}"? This cannot be undone.`
    : ''
)

const { pending: campaignsIndexPending } = useAsyncData(
  'tenant-campaigns-index',
  async () => {
    await store.fetchCampaigns()
    return true
  }
)

const filteredCampaigns = computed(() => {
  let list = campaigns.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((c) => c.name.toLowerCase().includes(q))
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((c) => c.status === statusFilter.value)
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCampaigns.value.length / PAGE_SIZE)))

const paginatedCampaigns = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredCampaigns.value.slice(start, start + PAGE_SIZE)
})

const paginationMeta = computed(() => {
  const total = filteredCampaigns.value.length
  if (!total) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage.value * PAGE_SIZE, total)
  return { from, to, total }
})

watch([searchQuery, statusFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

async function handleSend(c: Campaign) {
  if (!canSendDraft(c)) return
  await sendDraft(c)
}

async function handleResumeSend(c: Campaign) {
  if (!canResumeSend(c)) return
  await resumeSend(c)
}

async function handleResumeUnsentOnly(c: Campaign) {
  if (!canResumeUnsentOnly(c)) return
  await resumeUnsentOnly(c)
}

const campaignToSendAgain = ref<Campaign | null>(null)
const sendAgainConfirmLoading = ref(false)

function openSendAgainModal(c: Campaign) {
  if (!canOpenSendAgainModal(c)) return
  campaignToSendAgain.value = c
}

function cancelSendAgainModal() {
  campaignToSendAgain.value = null
}

async function confirmSendAgain() {
  const c = campaignToSendAgain.value
  if (!c || !canOpenSendAgainModal(c)) return
  sendAgainConfirmLoading.value = true
  try {
    await sendAgain(c)
    campaignToSendAgain.value = null
  } finally {
    sendAgainConfirmLoading.value = false
  }
}

const campaignToDiscard = ref<Campaign | null>(null)
const discardConfirmLoading = ref(false)

function openDiscardModal(c: Campaign) {
  campaignToDiscard.value = c
}

function cancelDiscardModal() {
  if (discardConfirmLoading.value) return
  campaignToDiscard.value = null
}

async function confirmDiscardPaused() {
  const c = campaignToDiscard.value
  if (!c || !canDiscardPaused(c) || discardConfirmLoading.value) return
  discardConfirmLoading.value = true
  try {
    await store.discardPausedCampaign(c.id)
    campaignToDiscard.value = null
    await store.fetchCampaigns()
  } finally {
    discardConfirmLoading.value = false
  }
}

function openDeleteModal(c: Campaign) {
  campaignToDelete.value = c
}

const deleteConfirmLoading = ref(false)

function cancelDeleteModal() {
  if (deleteConfirmLoading.value) return
  campaignToDelete.value = null
}

function cancelDuplicateModal() {
  if (duplicateConfirmLoading.value) return
  campaignToDuplicate.value = null
}

async function confirmDelete() {
  const c = campaignToDelete.value
  if (!c || deleteConfirmLoading.value) return
  deleteConfirmLoading.value = true
  try {
    await store.deleteCampaign(c)
    campaignToDelete.value = null
  } finally {
    deleteConfirmLoading.value = false
  }
}

function openDuplicateModal(c: Campaign) {
  campaignToDuplicate.value = c
}

const duplicateConfirmLoading = ref(false)

async function confirmDuplicate() {
  const c = campaignToDuplicate.value
  if (!c || duplicateConfirmLoading.value) return
  duplicateConfirmLoading.value = true
  try {
    const newId = await store.duplicateCampaign(c)
    campaignToDuplicate.value = null
    if (newId) await navigateTo(`/tenant/campaigns/edit/${newId}`)
  } finally {
    duplicateConfirmLoading.value = false
  }
}

function openScheduleModal(c: Campaign, mode: CampaignScheduleMode = 'new') {
  openScheduleForCampaign(c, mode)
}
</script>

<template>
  <div class="w-full min-w-0 space-y-8 antialiased">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Campaigns
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          Create sends, track draft and delivery status, and manage campaigns from one place.
        </p>
      </div>
      <NuxtLink
        to="/tenant/campaigns/add"
        class="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create campaign
      </NuxtLink>
    </header>

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

    <div
      v-if="campaignsIndexPending"
      class="animate-pulse space-y-5"
      aria-busy="true"
      aria-label="Loading campaigns"
    >
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
        <div class="h-11 w-full flex-1 rounded-xl bg-slate-200/80" />
        <div class="h-11 w-full shrink-0 rounded-xl bg-slate-200/80 sm:w-[11rem]" />
      </div>
      <div
        v-for="n in 5"
        :key="n"
        class="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] sm:px-6 sm:py-5"
      >
        <div class="flex items-start gap-3 sm:gap-4">
          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <div class="h-5 w-48 max-w-[70%] rounded-md bg-slate-200/90 sm:w-64" />
              <div class="h-5 w-16 rounded-full bg-slate-200/90" />
            </div>
            <div class="h-4 w-40 rounded bg-slate-200/90" />
          </div>
          <div class="flex shrink-0 gap-1">
            <div class="h-9 w-9 rounded-lg bg-slate-200/90" />
            <div class="h-9 w-9 rounded-lg bg-slate-200/90" />
          </div>
        </div>
      </div>
      <div
        class="flex h-14 items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 shadow-sm sm:px-6"
      >
        <div class="h-4 w-32 rounded bg-slate-200/90" />
        <div class="flex gap-2">
          <div class="h-9 w-20 rounded-xl bg-slate-200/90" />
          <div class="h-9 w-24 rounded-xl bg-slate-200/90" />
        </div>
      </div>
    </div>

    <template v-else>
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
      <div class="relative min-w-0 w-full max-w-lg">
        <label class="sr-only" for="campaigns-search">Search campaigns</label>
        <svg
          class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="campaigns-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          placeholder="Search campaigns…"
          class="w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-11 pr-4 text-[0.9375rem] text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
      </div>
      <div class="relative w-full shrink-0 sm:w-[11rem]">
        <select
          v-model="statusFilter"
          aria-label="Filter by status"
          class="h-full w-full min-h-[2.875rem] cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-[0.9375rem] font-medium text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
        <option value="all">
          All statuses
        </option>
        <option value="Draft">
          Draft
        </option>
        <option value="Sending">
          Sending
        </option>
        <option value="Scheduled">
          Scheduled
        </option>
        <option value="Sent">
          Sent
        </option>
        <option value="Failed">
          Failed
        </option>
        <option value="Paused">
          Paused
        </option>
        <option value="Cancelled">
          Cancelled
        </option>
        </select>
        <svg
          class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <div
      v-if="!filteredCampaigns.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm shadow-slate-900/[0.03] sm:py-20"
    >
      <div
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
      >
        <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
        {{ campaigns.length ? 'No matching campaigns' : 'No campaigns yet' }}
      </h3>
      <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
        {{ campaigns.length ? 'Try a different search or status filter.' : 'Create your first campaign to start sending email.' }}
      </p>
      <NuxtLink
        v-if="!campaigns.length"
        to="/tenant/campaigns/add"
        class="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
      >
        Create campaign
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </NuxtLink>
    </div>

    <div v-else class="space-y-5">
      <article
        v-for="c in paginatedCampaigns"
        :key="c.id"
        class="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-[border-color,box-shadow] hover:border-indigo-200/80 hover:shadow-md hover:shadow-slate-900/[0.06] sm:px-6 sm:py-5"
      >
        <div class="flex items-start gap-3 sm:gap-4">
          <NuxtLink
            :to="`/tenant/campaigns/${c.id}`"
            class="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-2"
          >
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 class="text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
                {{ c.name || 'Untitled' }}
              </h2>
              <span
                class="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset"
                :class="{
                  'bg-amber-50 text-amber-700 ring-amber-200/80': c.status === 'Draft',
                  'bg-sky-50 text-sky-700 ring-sky-200/80': c.status === 'Scheduled' || c.status === 'Sending',
                  'bg-amber-50 text-amber-800 ring-amber-200/80': c.status === 'Paused',
                  'bg-emerald-50 text-emerald-700 ring-emerald-200/80': c.status === 'Sent',
                  'bg-red-50 text-red-700 ring-red-200/80': c.status === 'Failed',
                  'bg-rose-50 text-rose-700 ring-rose-200/80': c.status === 'Cancelled',
                  'bg-slate-100 text-slate-600 ring-slate-200/80': !['Draft','Scheduled','Sending','Paused','Sent','Failed','Cancelled'].includes(c.status),
                }"
              >
                {{ c.status }}
              </span>
            </div>
            <p class="mt-2 text-sm text-slate-500">
              {{ campaignSubtitle(c, countdownNow) }}
            </p>
          </NuxtLink>
          <TenantCampaignRowActions
            :campaign="c"
            :sending-campaign-id="sendingCampaignId"
            :schedule-busy="scheduleBusy"
            :discard-confirm-loading="discardConfirmLoading"
            @send="handleSend"
            @resume-send="handleResumeSend"
            @resume-unsent="handleResumeUnsentOnly"
            @schedule="openScheduleModal"
            @send-again="openSendAgainModal"
            @discard="openDiscardModal"
            @stop-send="(campaign) => openStopSendModal(campaign.id)"
            @unschedule="unscheduleCampaign"
            @duplicate="openDuplicateModal"
            @delete="openDeleteModal"
          />
        </div>
      </article>

      <div
        class="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-4 text-sm text-slate-600 shadow-sm shadow-slate-900/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
      >
        <p class="tabular-nums text-slate-500">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="mx-1.5 text-slate-300">·</span>
          <span>{{ paginationMeta.total.toLocaleString() }} campaigns</span>
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:gap-2.5">
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            Previous
          </button>
          <span class="min-w-[6.5rem] px-1 text-center text-[0.8125rem] font-medium tabular-nums text-slate-500">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[0.8125rem] font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    </template>

    <ClientConfirmationModal
      :open="!!campaignToDelete"
      title="Delete campaign"
      :message="deleteModalMessage"
      confirm-text="Delete"
      variant="danger"
      :confirm-loading="deleteConfirmLoading"
      @confirm="confirmDelete"
      @cancel="cancelDeleteModal"
    />

    <ClientConfirmationModal
      :open="!!campaignToDuplicate"
      title="Duplicate campaign"
      :message="duplicateModalMessage(campaignToDuplicate)"
      confirm-text="Duplicate"
      :confirm-loading="duplicateConfirmLoading"
      @confirm="confirmDuplicate"
      @cancel="cancelDuplicateModal"
    />

    <ClientConfirmationModal
      :open="!!campaignToSendAgain"
      :title="sendAgainModalTitle(campaignToSendAgain)"
      :message="sendAgainModalMessage(campaignToSendAgain)"
      confirm-text="Send again"
      variant="danger"
      :confirm-loading="sendAgainConfirmLoading"
      @confirm="confirmSendAgain"
      @cancel="cancelSendAgainModal"
    />

    <ClientConfirmationModal
      :open="!!campaignToDiscard"
      title="Cancel this paused send?"
      :message="discardPausedModalMessage(campaignToDiscard)"
      confirm-text="Cancel permanently"
      variant="danger"
      :confirm-loading="discardConfirmLoading"
      @confirm="confirmDiscardPaused"
      @cancel="cancelDiscardModal"
    />

    <ClientSendProgressModal
      :open="!!sendingCampaignId"
      :campaign-id="sendingCampaignId"
      :campaign-name="campaigns.find((x) => x.id === sendingCampaignId)?.name || 'campaign'"
      :send-error="sendError"
      :send-progress="sendProgress"
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

    <TenantCampaignScheduleModal
      :open="scheduleOpen"
      :title="scheduleTitle"
      :description="scheduleDescription"
      :campaign-name="scheduleCampaign?.name"
      :schedule-local="scheduleLocal"
      :schedule-error="scheduleError"
      :schedule-busy="scheduleBusy"
      title-id="schedule-campaign-list-title"
      input-id="schedule-list-datetime"
      @update:schedule-local="scheduleLocal = $event"
      @close="closeScheduleModal"
      @confirm="confirmSchedule"
    />
  </div>
</template>
