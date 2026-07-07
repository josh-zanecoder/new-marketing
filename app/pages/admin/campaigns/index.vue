<script setup lang="ts">
import type { AdminCampaign } from '~/types/adminCampaign'
import { adminCampaignKey } from '~/types/adminCampaign'
import type { AdminTenantRow } from '~/types/adminTenant'
import { storeToRefs } from 'pinia'
import { useAdminCampaignStore } from '~/store/adminCampaignStore'
import {
  canPauseSend,
  canStopSend,
  canResumeSend,
  hasCancellableActiveCampaignSends
} from '~/composables/useCampaignSendFlow'
import { useAdminCampaignSendFlow } from '~/composables/admin/campaigns/useAdminCampaignSendFlow'

definePageMeta({ layout: 'admin' })

const store = useAdminCampaignStore()
const scheduleTenantDb = ref('')
const marketingApi = useTenantMarketingApi({ adminTenantDb: scheduleTenantDb })
const { campaigns, sendingCampaignKey, sendError } = storeToRefs(store)
const {
  sendProgress,
  startSendStatusPolling,
  dismissSendModal,
  closeSendModal,
  pauseSend,
  stopSend,
  cancelAllActiveSends,
  resumeSend
} = useAdminCampaignSendFlow()

const searchQuery = ref('')
const statusFilter = ref<string>('all')
const tenantFilter = ref('')
const tenants = ref<AdminTenantRow[]>([])

const statusFilterSelectOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Sending', label: 'Sending' },
  { value: 'Paused', label: 'Paused' },
  { value: 'Stopped', label: 'Stopped' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Failed', label: 'Failed' }
]

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

const sendControlBusy = ref(false)
const scheduleBusy = ref(false)
const cancelAllConfirmOpen = ref(false)
const currentPage = ref(1)
const PAGE_SIZE = 10

const { pending: campaignsIndexPending } = useAsyncData(
  'admin-campaigns-index',
  async () => {
    await store.fetchCampaigns()
    return true
  }
)

const filteredCampaigns = computed(() => {
  let list = campaigns.value
  if (tenantFilter.value) {
    list = list.filter((c) => c.tenantDbName === tenantFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tenantName.toLowerCase().includes(q)
    )
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((c) => c.status === statusFilter.value)
  }
  return list
})

const sendingCampaign = computed(() => {
  const key = sendingCampaignKey.value
  if (!key) return null
  return campaigns.value.find((x) => adminCampaignKey(x) === key) ?? null
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

watch([searchQuery, statusFilter, tenantFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

const sendSuccessSummary = ref<{
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
} | null>(null)

const campaignsInScope = computed(() =>
  tenantFilter.value
    ? campaigns.value.filter((c) => c.tenantDbName === tenantFilter.value)
    : campaigns.value
)

const hasCancellableActiveSends = computed(() =>
  hasCancellableActiveCampaignSends(campaignsInScope.value)
)

const cancellableSendCounts = computed(() => {
  const list = campaignsInScope.value
  return {
    sending: list.filter((c) => c.status === 'Sending').length,
    scheduled: list.filter((c) => c.status === 'Scheduled').length
  }
})

const cancelAllScopeLabel = computed(() => {
  if (!tenantFilter.value) return 'all tenants'
  const name = tenants.value.find((t) => t.dbName === tenantFilter.value)?.name
  return name ? `"${name}"` : 'the selected tenant'
})

const cancelAllConfirmMessage = computed(() => {
  const { sending, scheduled } = cancellableSendCounts.value
  const parts: string[] = []
  if (sending > 0) {
    parts.push(
      `${sending} sending campaign${sending === 1 ? '' : 's'} will be stopped`
    )
  }
  if (scheduled > 0) {
    parts.push(
      `${scheduled} scheduled send${scheduled === 1 ? '' : 's'} will be cancelled`
    )
  }
  const action = parts.join('; ')
  return `Across ${cancelAllScopeLabel.value}: ${action}. Stopped sends keep unsent emails and can be resumed later.`
})

async function handlePause(c: AdminCampaign) {
  if (!canPauseSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    await pauseSend(c)
  } finally {
    sendControlBusy.value = false
  }
}

async function handleStop(c: AdminCampaign) {
  if (!canStopSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    await stopSend(c)
  } finally {
    sendControlBusy.value = false
  }
}

async function confirmCancelAllActive() {
  if (sendControlBusy.value || !hasCancellableActiveSends.value) return
  sendControlBusy.value = true
  try {
    await cancelAllActiveSends(tenantFilter.value || undefined)
    cancelAllConfirmOpen.value = false
  } finally {
    sendControlBusy.value = false
  }
}

async function handleResume(c: AdminCampaign) {
  if (!canResumeSend(c) || sendControlBusy.value) return
  sendControlBusy.value = true
  try {
    const { poll } = await resumeSend(c)
    if (!poll) return
    startSendStatusPolling(c, async (res) => {
      const name = campaigns.value.find((x) => adminCampaignKey(x) === adminCampaignKey(c))?.name || 'campaign'
      await nextTick()
      sendSuccessSummary.value = {
        campaignName: name,
        sent: res.sent,
        failed: res.failed,
        campaignStatus: res.campaignStatus
      }
    })
  } finally {
    sendControlBusy.value = false
  }
}

async function handleUnschedule(c: AdminCampaign) {
  if (c.status !== 'Scheduled') return
  scheduleBusy.value = true
  try {
    scheduleTenantDb.value = c.tenantDbName
    await marketingApi.unscheduleCampaignSend(c.id)
    await store.fetchCampaigns()
  } finally {
    scheduleBusy.value = false
  }
}

function closeSendSuccessModal() {
  sendSuccessSummary.value = null
}

/** Human-readable time until scheduled send (updates with `countdownNow`). */
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

/** Subtitle under campaign title: "Sending Apr 7 • 2:16 AM", "Sent Apr 6", etc. */
function campaignSubtitle(c: AdminCampaign, nowMs: number): string {
  const tenant = c.tenantName ? `${c.tenantName} · ` : ''
  if (c.status === 'Scheduled' && c.scheduledAt) {
    const d = new Date(c.scheduledAt)
    if (Number.isNaN(d.getTime())) return `${tenant}Scheduled`
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    const when = `Sending ${md} • ${t}`
    const rem = scheduleRemainingUntil(c.scheduledAt, nowMs)
    return tenant + (rem && rem !== 'Send time reached' ? `${when} • ${rem}` : when)
  }
  if (c.status === 'Sent') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return `${tenant}Sent`
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${tenant}Sent ${md}`
  }
  if (c.status === 'Sending') return `${tenant}Sending in progress`
  if (c.status === 'Paused') return `${tenant}Paused — resume to continue sending`
  if (c.status === 'Stopped') {
    return `${tenant}Stopped — resume to continue from last unsent email`
  }
  if (c.status === 'Failed') {
    const raw = c.updatedAt || c.createdAt
    if (!raw) return `${tenant}Failed`
    const d = new Date(raw)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${tenant}Failed ${md}`
  }
  if (c.createdAt) {
    const d = new Date(c.createdAt)
    const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${tenant}Created ${md}`
  }
  return `${tenant}Draft`
}

async function loadTenants() {
  try {
    const res = await $fetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants')
    tenants.value = res.tenants ?? []
  } catch {
    tenants.value = []
  }
}

const countdownNow = ref(Date.now())
let countdownInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await loadTenants()
  countdownInterval = setInterval(() => {
    countdownNow.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="min-w-0 space-y-1">
        <p class="page-eyebrow">Outreach</p>
        <h1 class="page-title">
          Campaigns
        </h1>
        <p class="page-lead max-w-2xl sm:text-[0.9375rem] sm:leading-relaxed">
          Monitor campaign sends across tenants and pause, stop, or cancel active batches.
        </p>
    </header>

    <div
      v-if="sendError && !sendingCampaignKey"
      class="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 shadow-sm sm:flex-row sm:items-start sm:gap-3.5 sm:px-5"
      role="alert"
    >
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <div class="mt-0.5 shrink-0 text-amber-600">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <span class="min-w-0 flex-1 leading-relaxed">{{ sendError }}</span>
      </div>
      <button
        type="button"
        class="shrink-0 self-start rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100/90 sm:self-center"
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
        class="rounded-card border border-slate-200 bg-white px-4 py-4 shadow-card sm:px-6 sm:py-5"
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
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:flex-1">
      <div class="relative min-w-0 w-full sm:flex-1 sm:max-w-lg">
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
          class="input !rounded-input-lg bg-slate-50 py-3 pl-11 pr-4 focus:bg-white sm:py-3.5 sm:text-[0.9375rem]"
        >
      </div>
      <TenantFilterSelect
        id="admin-campaigns-tenant-filter"
        v-model="tenantFilter"
        label="Filter by tenant"
        :options="tenantFilterSelectOptions"
        class="w-full shrink-0 sm:w-[11rem]"
      />
      <TenantFilterSelect
        id="campaigns-status-filter"
        v-model="statusFilter"
        label="Filter by status"
        :options="statusFilterSelectOptions"
        class="w-full shrink-0 sm:w-[11rem]"
      />
      </div>
      <button
        type="button"
        class="inline-flex w-full shrink-0 items-center justify-center gap-2 self-stretch rounded-xl border border-red-200/90 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-900 shadow-sm transition-colors hover:bg-red-100/90 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 sm:w-auto sm:self-center"
        :disabled="!hasCancellableActiveSends || sendControlBusy"
        :title="
          hasCancellableActiveSends
            ? 'Stop all sending campaigns and cancel all scheduled sends in the current scope'
            : 'No sending or scheduled campaigns in the current scope'
        "
        @click="cancelAllConfirmOpen = true"
      >
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Cancel all active
      </button>
    </div>

    <div
      v-if="!filteredCampaigns.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center shadow-sm shadow-slate-900/[0.03] sm:px-6 sm:py-20"
    >
      <div
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100"
      >
        <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold tracking-tight text-slate-900">
        {{ campaigns.length ? 'No matching campaigns' : 'No campaigns yet' }}
      </h3>
      <p class="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-500 sm:text-[0.9375rem]">
        {{ campaigns.length ? 'Try a different search or status filter.' : 'Campaigns created by tenants will appear here.' }}
      </p>
    </div>

    <div v-else class="space-y-4 sm:space-y-5">
      <article
        v-for="c in paginatedCampaigns"
        :key="c.id"
        class="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-[border-color,box-shadow] hover:border-primary-200/80 hover:shadow-md hover:shadow-slate-900/[0.06] sm:px-6 sm:py-5"
      >
        <NuxtLink
          :to="`/admin/campaigns/${encodeURIComponent(c.tenantDbName)}/${encodeURIComponent(c.id)}`"
          class="block min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-2"
        >
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="min-w-0 truncate text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
              {{ c.name || 'Untitled' }}
            </h2>
            <span
              class="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset"
              :class="{
                'bg-amber-50 text-amber-700 ring-amber-200/80': c.status === 'Draft',
                'bg-sky-50 text-sky-700 ring-sky-200/80': c.status === 'Scheduled' || c.status === 'Sending',
                'bg-violet-50 text-violet-700 ring-violet-200/80': c.status === 'Paused',
                'bg-orange-50 text-orange-700 ring-orange-200/80': c.status === 'Stopped',
                'bg-emerald-50 text-emerald-700 ring-emerald-200/80': c.status === 'Sent',
                'bg-red-50 text-red-700 ring-red-200/80': c.status === 'Failed',
                'bg-slate-100 text-slate-600 ring-slate-200/80': !['Draft','Scheduled','Sending','Sent','Failed'].includes(c.status),
              }"
            >
              {{ c.status }}
            </span>
          </div>
          <p class="mt-1.5 line-clamp-2 text-sm text-slate-500 sm:line-clamp-none">
            {{ campaignSubtitle(c, countdownNow) }}
          </p>
        </NuxtLink>
        <div class="mt-3 flex flex-wrap items-center gap-0.5 border-t border-slate-100 pt-3 sm:mt-4">
          <button
            v-if="canPauseSend(c)"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-violet-600 transition-colors hover:bg-violet-50 hover:text-violet-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="sendControlBusy"
            title="Pause send"
            @click.stop="handlePause(c)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            v-if="canStopSend(c)"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="sendControlBusy"
            title="Stop send"
            @click.stop="handleStop(c)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
          <button
            v-if="canResumeSend(c)"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="sendControlBusy || !!sendingCampaignKey"
            title="Resume send"
            @click.stop="handleResume(c)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            v-if="c.status === 'Scheduled'"
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="scheduleBusy"
            title="Cancel scheduled send"
            @click.stop="handleUnschedule(c)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </article>

      <div
        class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 shadow-sm shadow-slate-900/[0.03] sm:gap-4 sm:px-6 sm:py-4"
      >
        <p class="min-w-0 text-xs tabular-nums text-slate-500 sm:text-sm">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="text-slate-300"> / </span>
          <span>{{ paginationMeta.total.toLocaleString() }}</span>
        </p>
        <nav
          class="flex shrink-0 items-center gap-1 sm:gap-1.5"
          aria-label="Campaigns pagination"
        >
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            <span class="sm:hidden">Prev</span>
            <span class="hidden sm:inline">Previous</span>
          </button>
          <span class="whitespace-nowrap px-1 text-center text-xs font-medium tabular-nums text-slate-500 sm:min-w-[6.5rem] sm:text-[0.8125rem]">
            <span class="sm:hidden">{{ currentPage }}/{{ totalPages }}</span>
            <span class="hidden sm:inline">Page {{ currentPage }} / {{ totalPages }}</span>
          </span>
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-[0.8125rem]"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </nav>
      </div>
    </div>
    </template>

    <ClientConfirmationModal
      :open="cancelAllConfirmOpen"
      title="Cancel all active sends"
      :message="cancelAllConfirmMessage"
      confirm-text="Cancel all"
      variant="danger"
      :confirm-loading="sendControlBusy"
      @confirm="confirmCancelAllActive"
      @cancel="cancelAllConfirmOpen = false"
    />

    <ClientSendProgressModal
      :open="!!sendingCampaignKey"
      :campaign-id="sendingCampaign?.id ?? ''"
      :campaign-name="sendingCampaign?.name || 'campaign'"
      :admin-tenant-db="sendingCampaign?.tenantDbName"
      :send-error="sendError"
      :send-progress="sendProgress"
      @close="dismissSendModal"
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
