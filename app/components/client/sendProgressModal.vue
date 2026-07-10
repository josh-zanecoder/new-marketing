<script setup lang="ts">
import type {
  Campaign,
  CampaignSendRecipientReport,
  CampaignSendRecipientReportStatus
} from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'
import { useAdminCampaignStore } from '~/store/adminCampaignStore'
import { useAdminCampaignsApi } from '~/composables/admin/campaigns/useAdminCampaigns'
import { canRestartSend, canResumeSend, canStopSend } from '~/composables/useCampaignSendFlow'

const props = defineProps<{
  open: boolean
  campaignId: string | null
  campaignName: string
  sendError: string | null
  sendProgress: {
    total: number
    sent: number
    failed: number
    aborted?: number
    remaining: number
    processed: number
    pct: number
    done: boolean
    campaignStatus: string
  } | null
  /** Admin console: tenant DB for scoped send APIs via x-admin-tenant-db. */
  adminTenantDb?: string
}>()

const emit = defineEmits<{
  close: []
  'send-control': [detail: { action: 'pause' | 'stop' | 'resume' | 'restart'; poll?: boolean }]
}>()

const marketingApi = useTenantMarketingApi({
  adminTenantDb: computed(() => props.adminTenantDb)
})
const adminSendsApi = useAdminCampaignsApi()
const campaignStore = useCampaignStore()
const adminCampaignStore = useAdminCampaignStore()

const reportTab = ref<CampaignSendRecipientReportStatus>('all')
const reportPage = ref(1)
const reportSearch = ref('')
const report = ref<CampaignSendRecipientReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const selectedEmails = ref<Set<string>>(new Set())
const abortBusy = ref(false)
const abortMessage = ref('')
const sendControlBusy = ref(false)
const resumeConfirmOpen = ref(false)
const restartConfirmOpen = ref(false)

const adminDb = computed(() => props.adminTenantDb?.trim() || '')

const campaignForSendControl = computed((): Campaign | null => {
  const id = props.campaignId
  const status = props.sendProgress?.campaignStatus
  if (!id || !status) return null
  return {
    id,
    name: props.campaignName,
    status,
    sender: { name: '', email: '' },
    recipientsType: 'manual',
    subject: '',
    recipients: [],
    createdAt: '',
    updatedAt: ''
  }
})

const showStopSend = computed(
  () => !!campaignForSendControl.value && canStopSend(campaignForSendControl.value)
)
const showResumeSend = computed(
  () => !!campaignForSendControl.value && canResumeSend(campaignForSendControl.value)
)
const showRestartSend = computed(
  () => !!campaignForSendControl.value && canRestartSend(campaignForSendControl.value)
)

const isActivelySending = computed(
  () =>
    !!props.sendProgress &&
    !props.sendProgress.done &&
    props.sendProgress.campaignStatus === 'Sending'
)

const REPORT_LIMIT = 50

const canSelectRecipients = computed(() => {
  const status = props.sendProgress?.campaignStatus ?? report.value?.campaignStatus
  return (
    !props.sendProgress?.done &&
    (status === 'Sending' || status === 'Paused' || status === 'Stopped')
  )
})

const selectedCount = computed(() => selectedEmails.value.size)

const tabs: { id: CampaignSendRecipientReportStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'aborted', label: 'Aborted' }
]

function displayRecipientStatus(status?: string) {
  if (status === 'cancelled') return 'aborted'
  return status
}

function statusBadgeClass(status?: string) {
  const s = displayRecipientStatus(status)
  if (s === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
  if (s === 'failed') return 'bg-red-50 text-red-800 ring-red-200/70'
  if (s === 'aborted') return 'bg-slate-100 text-slate-700 ring-slate-200/70'
  if (status === 'sending') return 'bg-sky-50 text-sky-800 ring-sky-200/70'
  return 'bg-amber-50 text-amber-800 ring-amber-200/70'
}

function isSelectableRow(status?: string) {
  return canSelectRecipients.value && status === 'pending'
}

function isRowSelected(email: string) {
  return selectedEmails.value.has(email)
}

function toggleRow(email: string) {
  const next = new Set(selectedEmails.value)
  if (next.has(email)) next.delete(email)
  else next.add(email)
  selectedEmails.value = next
}

const selectableOnPage = computed(() =>
  (report.value?.items ?? []).filter((row) => isSelectableRow(row.status))
)

const allPageSelected = computed(
  () =>
    selectableOnPage.value.length > 0 &&
    selectableOnPage.value.every((row) => selectedEmails.value.has(row.email))
)

function toggleSelectAllPage() {
  const next = new Set(selectedEmails.value)
  if (allPageSelected.value) {
    for (const row of selectableOnPage.value) next.delete(row.email)
  } else {
    for (const row of selectableOnPage.value) next.add(row.email)
  }
  selectedEmails.value = next
}

async function refreshSendProgress() {
  const id = props.campaignId
  if (!id) return
  try {
    const res = await marketingApi.fetchSendCampaignStatus(id)
    const status = { ...res, campaignId: id }
    if (props.adminTenantDb?.trim()) {
      adminCampaignStore.setSendStatus(status)
    } else {
      campaignStore.setSendStatus(status)
    }
  } catch {
    // keep existing progress
  }
}

async function handleStopSend() {
  const c = campaignForSendControl.value
  if (!c || !showStopSend.value || sendControlBusy.value) return
  sendControlBusy.value = true
  reportError.value = ''
  try {
    const ok = adminDb.value
      ? await adminCampaignStore.stopCampaignSend({
          ...c,
          tenantDbName: adminDb.value,
          tenantName: ''
        })
      : await campaignStore.stopCampaignSend(c)
    if (ok) {
      await refreshSendProgress()
      emit('send-control', { action: 'stop' })
    }
  } finally {
    sendControlBusy.value = false
  }
}

async function confirmResumeSend() {
  const c = campaignForSendControl.value
  if (!c || !showResumeSend.value || sendControlBusy.value) return
  sendControlBusy.value = true
  reportError.value = ''
  try {
    const { poll } = adminDb.value
      ? await adminCampaignStore.resumeCampaignSend({
          ...c,
          tenantDbName: adminDb.value,
          tenantName: ''
        })
      : await campaignStore.resumeCampaignSend(c)
    resumeConfirmOpen.value = false
    await refreshSendProgress()
    emit('send-control', { action: 'resume', poll })
  } finally {
    sendControlBusy.value = false
  }
}

async function confirmRestartSend() {
  const c = campaignForSendControl.value
  if (!c || !showRestartSend.value || sendControlBusy.value) return
  sendControlBusy.value = true
  reportError.value = ''
  try {
    const { poll } = adminDb.value
      ? await adminCampaignStore.restartCampaignSend({
          ...c,
          tenantDbName: adminDb.value,
          tenantName: ''
        })
      : await campaignStore.restartCampaignSend(c)
    restartConfirmOpen.value = false
    await refreshSendProgress()
    emit('send-control', { action: 'restart', poll })
  } finally {
    sendControlBusy.value = false
  }
}

async function abortSelected() {
  const id = props.campaignId
  if (!id || selectedCount.value === 0 || abortBusy.value) return
  abortBusy.value = true
  abortMessage.value = ''
  reportError.value = ''
  try {
    const adminDb = props.adminTenantDb?.trim()
    const res = adminDb
      ? await adminSendsApi.abortCampaignRecipients(adminDb, id, [...selectedEmails.value])
      : await marketingApi.abortCampaignRecipients(id, [...selectedEmails.value])
    selectedEmails.value = new Set()
    const parts: string[] = []
    if (res.aborted > 0) parts.push(`${res.aborted} aborted`)
    if (res.skipped > 0) parts.push(`${res.skipped} skipped (already sent or in flight)`)
    if (res.notFound > 0) parts.push(`${res.notFound} not found`)
    abortMessage.value = parts.join(' · ')
    await Promise.all([loadReport(), refreshSendProgress()])
  } catch (e: unknown) {
    reportError.value =
      e instanceof Error ? e.message : 'Could not abort selected recipients.'
  } finally {
    abortBusy.value = false
  }
}

async function loadReport() {
  const id = props.campaignId
  if (!id || !props.open) return
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await marketingApi.fetchCampaignSendRecipients(id, {
      status: reportTab.value,
      page: reportPage.value,
      limit: REPORT_LIMIT,
      search: reportSearch.value
    })
  } catch (e: unknown) {
    report.value = null
    reportError.value =
      e instanceof Error ? e.message : 'Could not load recipient report.'
  } finally {
    reportLoading.value = false
  }
}

function selectTab(tab: CampaignSendRecipientReportStatus) {
  if (reportTab.value === tab) return
  reportTab.value = tab
  reportPage.value = 1
  void loadReport()
}

function tabCount(tab: CampaignSendRecipientReportStatus): number | null {
  const c = report.value?.counts
  if (!c && props.sendProgress) {
    if (tab === 'sent') return props.sendProgress.sent
    if (tab === 'pending') return props.sendProgress.remaining
    if (tab === 'failed') return props.sendProgress.failed
    if (tab === 'aborted') return props.sendProgress.aborted ?? 0
    if (tab === 'all') return props.sendProgress.total
  }
  if (!c) return null
  if (tab === 'sent') return c.sent
  if (tab === 'pending') return c.pending
  if (tab === 'failed') return c.failed
  if (tab === 'aborted') return c.aborted
  return c.total
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(
  () => reportSearch.value,
  () => {
    if (!props.open) return
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      reportPage.value = 1
      void loadReport()
    }, 350)
  }
)

watch(
  () => [props.open, props.campaignId] as const,
  ([open, id]) => {
    if (open && id) {
      reportPage.value = 1
      void loadReport()
    } else if (!open) {
      report.value = null
      reportError.value = ''
      reportSearch.value = ''
      reportTab.value = 'all'
      reportPage.value = 1
      selectedEmails.value = new Set()
      abortMessage.value = ''
      resumeConfirmOpen.value = false
      restartConfirmOpen.value = false
    }
  },
  { immediate: true }
)

watch(
  () =>
    props.sendProgress
      ? `${props.sendProgress.sent}|${props.sendProgress.failed}|${props.sendProgress.remaining}|${props.sendProgress.processed}`
      : '',
  () => {
    if (props.open && props.campaignId) void loadReport()
  }
)

watch(reportPage, () => {
  if (props.open && props.campaignId) void loadReport()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200/60 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-progress-modal-title"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="flex min-w-0 items-center gap-2">
            <svg
              v-if="isActivelySending"
              class="h-5 w-5 shrink-0 animate-spin text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 id="send-progress-modal-title" class="truncate text-lg font-semibold text-slate-900">
              <template v-if="props.sendProgress?.done">Send finished</template>
              <template v-else-if="props.sendProgress?.campaignStatus === 'Paused'">
                Send paused — {{ props.campaignName || 'campaign' }}
              </template>
              <template v-else-if="props.sendProgress?.campaignStatus === 'Stopped'">
                Send stopped — {{ props.campaignName || 'campaign' }}
              </template>
              <template v-else>Sending {{ props.campaignName || 'campaign' }}</template>
            </h3>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div v-if="props.sendError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ props.sendError }}
          </div>
          <div v-else-if="props.sendProgress" class="space-y-5">
            <div>
              <p class="text-base font-medium text-slate-900">
                <template v-if="props.sendProgress.done">
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} processed
                </template>
                <template v-else-if="props.sendProgress.campaignStatus === 'Paused'">
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} — paused
                </template>
                <template v-else-if="props.sendProgress.campaignStatus === 'Stopped'">
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} — stopped
                </template>
                <template v-else>
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} — sending
                </template>
              </p>
              <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  class="h-full rounded-full bg-slate-900 transition-all duration-700 ease-out"
                  :style="{ width: `${props.sendProgress.pct}%` }"
                />
              </div>
              <div class="mt-4 grid grid-cols-3 gap-3">
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.sent }}</div>
                  <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Sent</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.failed }}</div>
                  <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">Failed</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.remaining }}</div>
                  <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">Pending</div>
                </div>
              </div>
              <div
                v-if="showStopSend || showResumeSend || showRestartSend"
                class="mt-4 flex flex-wrap gap-2"
              >
                <button
                  v-if="showStopSend"
                  type="button"
                  class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-950 hover:bg-red-100/90 disabled:opacity-40 sm:text-sm"
                  :disabled="sendControlBusy || abortBusy"
                  @click="handleStopSend"
                >
                  {{ sendControlBusy ? 'Stopping…' : 'Stop send' }}
                </button>
                <button
                  v-if="showResumeSend"
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 sm:text-sm"
                  :disabled="sendControlBusy || abortBusy"
                  @click="resumeConfirmOpen = true"
                >
                  Resume
                </button>
                <button
                  v-if="showRestartSend"
                  type="button"
                  class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40 sm:text-sm"
                  :disabled="sendControlBusy || abortBusy"
                  @click="restartConfirmOpen = true"
                >
                  Send again
                </button>
              </div>
            </div>

            <div v-if="props.campaignId" class="border-t border-slate-100 pt-5">
              <h4 class="text-sm font-semibold text-slate-900">Delivery report</h4>
              <p class="mt-1 text-xs text-slate-500">
                Live list of recipients by status. Updates while the send is in progress.
              </p>

              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors sm:text-sm"
                  :class="
                    reportTab === tab.id
                      ? 'bg-primary-600 text-white ring-primary-600'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                  "
                  @click="selectTab(tab.id)"
                >
                  {{ tab.label }}
                  <span v-if="tabCount(tab.id) != null" class="ml-1 tabular-nums opacity-90">
                    ({{ tabCount(tab.id) }})
                  </span>
                </button>
              </div>

              <div
                v-if="canSelectRecipients && (reportTab === 'pending' || reportTab === 'all')"
                class="mt-3 flex flex-wrap items-center gap-2"
              >
                <button
                  v-if="selectableOnPage.length > 0"
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:text-sm"
                  :disabled="reportLoading || abortBusy"
                  @click="toggleSelectAllPage"
                >
                  {{ allPageSelected ? 'Deselect page' : 'Select pending on page' }}
                </button>
                <button
                  v-if="selectedCount > 0"
                  type="button"
                  class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100/90 disabled:opacity-40 sm:text-sm"
                  :disabled="abortBusy"
                  @click="abortSelected"
                >
                  {{ abortBusy ? 'Aborting…' : `Abort selected (${selectedCount})` }}
                </button>
              </div>
              <p v-if="abortMessage" class="mt-2 text-xs text-slate-600">{{ abortMessage }}</p>

              <label class="mt-3 block">
                <span class="sr-only">Search recipients</span>
                <input
                  v-model="reportSearch"
                  type="search"
                  placeholder="Search email…"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
                >
              </label>

              <div
                v-if="reportLoading && !report?.items.length"
                class="mt-4 flex items-center gap-2 text-sm text-slate-500"
              >
                <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading recipients…
              </div>
              <p v-else-if="reportError" class="mt-4 text-sm text-red-600" role="alert">{{ reportError }}</p>
              <ul
                v-else-if="report?.items.length"
                class="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200"
              >
                <li
                  v-for="(row, idx) in report.items"
                  :key="`${row.email}-${idx}`"
                  class="flex items-start gap-3 px-3 py-2.5 text-sm"
                >
                  <label
                    v-if="isSelectableRow(row.status)"
                    class="mt-0.5 flex shrink-0 cursor-pointer items-center"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                      :checked="isRowSelected(row.email)"
                      @change="toggleRow(row.email)"
                    >
                    <span class="sr-only">Select {{ row.email }}</span>
                  </label>
                  <div
                    v-else-if="canSelectRecipients"
                    class="mt-0.5 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div class="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-medium text-slate-900">{{ row.email }}</div>
                      <p
                        v-if="row.status === 'failed' && row.error"
                        class="mt-0.5 truncate text-xs text-red-600"
                        :title="row.error"
                      >
                        {{ row.error }}
                      </p>
                      <p
                        v-else-if="(row.status === 'aborted' || row.status === 'cancelled') && row.error"
                        class="mt-0.5 truncate text-xs text-slate-500"
                      >
                        {{ row.error }}
                      </p>
                      <p v-else-if="row.sentAt" class="mt-0.5 text-xs text-slate-500">
                        {{ new Date(row.sentAt).toLocaleString() }}
                      </p>
                    </div>
                    <span
                      v-if="row.status"
                      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1"
                      :class="statusBadgeClass(row.status)"
                    >
                      {{ displayRecipientStatus(row.status) }}
                    </span>
                  </div>
                </li>
              </ul>
              <p v-else class="mt-4 text-sm text-slate-500">No recipients in this filter.</p>

              <div
                v-if="report && report.totalPages > 1"
                class="mt-4 flex items-center justify-between gap-3 text-sm"
              >
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  :disabled="reportPage <= 1 || reportLoading"
                  @click="reportPage -= 1"
                >
                  Previous
                </button>
                <span class="tabular-nums text-slate-500">
                  Page {{ report.page }} / {{ report.totalPages }}
                </span>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
                  :disabled="reportPage >= report.totalPages || reportLoading"
                  @click="reportPage += 1"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div v-else class="flex items-center gap-3 text-sm text-slate-500">
            <svg class="h-5 w-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting…
          </div>
        </div>
      </div>
    </div>
  </Teleport>

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
</template>
