<script setup lang="ts">
import type { Campaign } from '~/types/campaign'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '~/store/campaignStore'

const store = useCampaignStore()
const marketingApi = useTenantMarketingApi()
const { campaigns, sendingCampaignId, sendError } = storeToRefs(store)
const { canSendDraft, canScheduleDraft, sendProgress, startSendStatusPolling, closeSendModal } =
  useCampaignSendFlow()

const searchQuery = ref('')
const statusFilter = ref<string>('all')
const campaignToDelete = ref<Campaign | null>(null)
const campaignToDuplicate = ref<Campaign | null>(null)
const campaignToSchedule = ref<Campaign | null>(null)
const scheduleLocal = ref('')
const scheduleError = ref('')
const scheduleBusy = ref(false)
const currentPage = ref(1)
const PAGE_SIZE = 10

const deleteModalMessage = computed(() =>
  campaignToDelete.value
    ? `Are you sure you want to delete "${campaignToDelete.value.name || 'Untitled'}"? This cannot be undone.`
    : ''
)

const duplicateModalMessage = computed(() =>
  campaignToDuplicate.value
    ? `Create a copy of "${campaignToDuplicate.value.name || 'Untitled'}"? The duplicate will be created as a draft.`
    : ''
)

await store.fetchCampaigns()

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

function recipientCount(c: Campaign): number {
  return c.recipients?.length ?? 0
}

const sendSuccessSummary = ref<{
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
} | null>(null)

async function handleSend(c: Campaign) {
  if (!canSendDraft(c)) return
  const { poll } = await store.sendCampaign(c)
  if (!poll) return
  const campaignId = c.id
  startSendStatusPolling(campaignId, async (res) => {
    const name = campaigns.value.find((x) => x.id === campaignId)?.name || 'campaign'
    await nextTick()
    sendSuccessSummary.value = {
      campaignName: name,
      sent: res.sent,
      failed: res.failed,
      campaignStatus: res.campaignStatus
    }
  })
}

function openDeleteModal(c: Campaign) {
  campaignToDelete.value = c
}

async function confirmDelete() {
  const c = campaignToDelete.value
  if (!c) return
  campaignToDelete.value = null
  await store.deleteCampaign(c)
}

function openDuplicateModal(c: Campaign) {
  campaignToDuplicate.value = c
}

async function confirmDuplicate() {
  const c = campaignToDuplicate.value
  if (!c) return
  campaignToDuplicate.value = null
  const newId = await store.duplicateCampaign(c)
  if (newId) await navigateTo(`/tenant/campaigns/add?id=${newId}`)
}

function closeSendSuccessModal() {
  sendSuccessSummary.value = null
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openScheduleModal(c: Campaign) {
  campaignToSchedule.value = c
  scheduleError.value = ''
  scheduleLocal.value = toDatetimeLocalValue(new Date(Date.now() + 65 * 60 * 1000))
}

function closeScheduleModal() {
  campaignToSchedule.value = null
  scheduleError.value = ''
}

async function confirmScheduleFromList() {
  const c = campaignToSchedule.value
  if (!c) return
  scheduleError.value = ''
  const parsed = new Date(scheduleLocal.value)
  if (Number.isNaN(parsed.getTime())) {
    scheduleError.value = 'Pick a valid date and time.'
    return
  }
  scheduleBusy.value = true
  try {
    await marketingApi.scheduleCampaignSend(c.id, parsed.toISOString())
    campaignToSchedule.value = null
    await store.fetchCampaigns()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? (e as { data?: { message?: string } }).data?.message
        : e instanceof Error
          ? e.message
          : 'Could not schedule send.'
    scheduleError.value = typeof msg === 'string' ? msg : 'Could not schedule send.'
  } finally {
    scheduleBusy.value = false
  }
}

async function handleUnschedule(c: Campaign) {
  if (c.status !== 'Scheduled') return
  scheduleBusy.value = true
  try {
    await marketingApi.unscheduleCampaignSend(c.id)
    await store.fetchCampaigns()
  } finally {
    scheduleBusy.value = false
  }
}

function formatScheduleHint(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="w-full min-w-0">
    <header class="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Campaigns
        </h1>
        <p class="max-w-xl text-sm text-zinc-500 sm:text-[15px]">
          Create sends, track draft and delivery status, and manage campaigns from one place.
        </p>
      </div>
      <NuxtLink
        to="/tenant/campaigns/add"
        class="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-zinc-900/20 transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
      >
        <svg class="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create campaign
      </NuxtLink>
    </header>

    <div
      v-if="sendError && !sendingCampaignId"
      class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-amber-50/30 px-4 py-3.5 text-sm text-amber-950 shadow-sm shadow-amber-900/5"
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
        class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/80"
        @click="closeSendModal()"
      >
        Dismiss
      </button>
    </div>

    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div class="relative min-w-0 w-full sm:w-80 md:w-96">
        <label class="sr-only" for="campaigns-search">Search campaigns</label>
        <svg class="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="campaigns-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          placeholder="Search by campaign name…"
          class="w-full rounded-2xl border border-zinc-200/90 bg-white py-3 pl-12 pr-4 text-sm text-zinc-900 shadow-sm shadow-zinc-950/5 placeholder:text-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
      </div>
      <select
        v-model="statusFilter"
        aria-label="Filter by status"
        class="shrink-0 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:min-w-[11rem]"
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
      </select>
    </div>

    <div
      v-if="!filteredCampaigns.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm sm:py-20"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
        <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="mt-5 text-lg font-semibold text-zinc-900">
        {{ campaigns.length ? 'No matching campaigns' : 'No campaigns yet' }}
      </h3>
      <p class="mt-2 max-w-sm text-sm text-zinc-500">
        {{ campaigns.length ? 'Try a different search or status filter.' : 'Create your first campaign to start sending email.' }}
      </p>
      <NuxtLink
        v-if="!campaigns.length"
        to="/tenant/campaigns/add"
        class="mt-8 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
      >
        Create campaign
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </NuxtLink>
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="c in paginatedCampaigns"
        :key="c.id"
        class="group/card flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-950/[0.04] transition hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-950/[0.06] sm:flex-row sm:items-center sm:gap-5 sm:p-5"
      >
        <NuxtLink
          :to="`/tenant/campaigns/${c.id}`"
          class="flex min-w-0 flex-1 flex-col gap-4 outline-none sm:flex-row sm:items-center sm:gap-6 focus-visible:ring-2 focus-visible:ring-zinc-900/15 sm:rounded-lg"
        >
          <div class="min-w-0 flex-1">
            <span class="text-base font-semibold text-zinc-900 transition group-hover/card:text-zinc-700">
              {{ c.name || 'Untitled' }}
            </span>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset"
                :class="{
                  'bg-amber-50 text-amber-800 ring-amber-200/80': c.status === 'Draft',
                  'bg-sky-50 text-sky-800 ring-sky-200/80': c.status === 'Scheduled' || c.status === 'Sending',
                  'bg-emerald-50 text-emerald-800 ring-emerald-200/80': c.status === 'Sent',
                  'bg-red-50 text-red-800 ring-red-200/80': c.status === 'Failed',
                  'bg-zinc-100 text-zinc-700 ring-zinc-200/80': !['Draft','Scheduled','Sending','Sent','Failed'].includes(c.status),
                }"
              >
                {{ c.status }}
              </span>
              <span class="font-mono tabular-nums text-zinc-400">#{{ c.id.slice(-6) }}</span>
              <span v-if="c.createdAt" class="tabular-nums">{{ new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
              <span
                v-if="c.status === 'Scheduled' && c.scheduledAt"
                class="text-sky-800"
              >
                · Sends {{ formatScheduleHint(c.scheduledAt) }}
              </span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 text-sm sm:flex-1 sm:border-t-0 sm:pt-0 md:grid-cols-4">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Recipients
              </div>
              <div class="mt-0.5 font-medium tabular-nums text-zinc-800">
                {{ recipientCount(c).toLocaleString() }}
              </div>
            </div>
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Opens
              </div>
              <div class="mt-0.5 text-zinc-400">
                —
              </div>
            </div>
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Clicks
              </div>
              <div class="mt-0.5 text-zinc-400">
                —
              </div>
            </div>
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Conversions
              </div>
              <div class="mt-0.5 text-zinc-400">
                —
              </div>
            </div>
          </div>
        </NuxtLink>
        <div class="flex shrink-0 items-center justify-end gap-1 border-t border-zinc-100 pt-3 sm:border-t-0 sm:pt-0">
          <button
            v-if="canSendDraft(c)"
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900/20 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!!sendingCampaignId || scheduleBusy"
            title="Send campaign"
            @click.stop="handleSend(c)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
          <button
            v-if="canScheduleDraft(c)"
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!!sendingCampaignId || scheduleBusy"
            title="Schedule send"
            @click.stop="openScheduleModal(c)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            v-if="c.status === 'Scheduled'"
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50 hover:text-amber-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="scheduleBusy"
            title="Cancel schedule"
            @click.stop="handleUnschedule(c)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            v-if="c.status === 'Sent'"
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-900/20"
            title="Duplicate campaign"
            @click.stop="openDuplicateModal(c)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/30"
            title="Delete campaign"
            @click.stop="openDeleteModal(c)"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </article>

      <div class="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p class="tabular-nums text-zinc-500">
          <span class="font-medium text-zinc-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          of {{ paginationMeta.total.toLocaleString() }}
        </p>
        <div class="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            Previous
          </button>
          <span class="min-w-[5rem] text-center tabular-nums text-zinc-500">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="inline-flex min-w-[88px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <ClientConfirmationModal
      :open="!!campaignToDelete"
      title="Delete campaign"
      :message="deleteModalMessage"
      confirm-text="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="campaignToDelete = null"
    />

    <!-- Duplicate confirmation modal -->
    <ClientConfirmationModal
      :open="!!campaignToDuplicate"
      title="Duplicate campaign"
      :message="duplicateModalMessage"
      confirm-text="Duplicate"
      @confirm="confirmDuplicate"
      @cancel="campaignToDuplicate = null"
    />

    <ClientSendProgressModal
      :open="!!sendingCampaignId"
      :campaign-name="campaigns.find((x) => x.id === sendingCampaignId)?.name || 'campaign'"
      :send-error="sendError"
      :send-progress="sendProgress"
      @close="closeSendModal"
    />

    <ClientSendSuccessModal
      :open="!!sendSuccessSummary"
      :campaign-name="sendSuccessSummary?.campaignName ?? ''"
      :sent="sendSuccessSummary?.sent ?? 0"
      :failed="sendSuccessSummary?.failed ?? 0"
      :campaign-status="sendSuccessSummary?.campaignStatus ?? ''"
      @close="closeSendSuccessModal"
    />

    <Teleport to="body">
      <div
        v-if="campaignToSchedule"
        class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-campaign-list-title"
      >
        <div
          class="absolute inset-0 bg-zinc-950/55 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="closeScheduleModal"
        />
        <div
          class="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl ring-1 ring-zinc-200/90 sm:rounded-2xl sm:p-6"
        >
          <h2 id="schedule-campaign-list-title" class="text-lg font-semibold text-zinc-900">
            Schedule send
          </h2>
          <p class="mt-1 truncate text-sm text-zinc-600" :title="campaignToSchedule.name">
            {{ campaignToSchedule.name || 'Untitled' }}
          </p>
          <label class="mt-4 block text-sm font-medium text-zinc-700" for="schedule-list-datetime">
            Date &amp; time
          </label>
          <input
            id="schedule-list-datetime"
            v-model="scheduleLocal"
            type="datetime-local"
            class="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
          <p v-if="scheduleError" class="mt-3 text-sm text-red-600" role="alert">
            {{ scheduleError }}
          </p>
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              class="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              :disabled="scheduleBusy"
              @click="closeScheduleModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              :disabled="scheduleBusy"
              @click="confirmScheduleFromList"
            >
              {{ scheduleBusy ? 'Saving…' : 'Schedule' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
