<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type {
  CampaignSendRecipientReport,
  CampaignSendRecipientReportStatus
} from '~/types/campaign'
import { canStopSending } from '~/utils/campaignSendRules'
import { useCampaignStore } from '~/store/campaignStore'

const props = defineProps<{
  open: boolean
  campaignId: string | null
  campaignName: string
  sendError: string | null
  sendProgress: {
    total: number
    sent: number
    sending?: number
    inFlight?: number
    failed: number
    remaining: number
    processed: number
    pct: number
    done: boolean
    preparing?: boolean
    campaignStatus: string
  } | null
}>()

const emit = defineEmits<{
  close: []
}>()

const marketingApi = useTenantMarketingApi()
const campaignStore = useCampaignStore()
const { sendCancelReport } = storeToRefs(campaignStore)
const { pauseSendingCampaign, cancelSendingCampaign } = useCampaignSendFlow()

const reportTab = ref<CampaignSendRecipientReportStatus>('all')
const reportPage = ref(1)
const reportSearch = ref('')
const report = ref<CampaignSendRecipientReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')
const stopBusy = ref(false)
const cancelReport = sendCancelReport

const REPORT_LIMIT = 50

const canShowStop = computed(
  () => !!props.campaignId && canStopSending(props.sendProgress, props.sendProgress?.campaignStatus)
)

const modalTitle = computed(() => {
  if (cancelReport.value?.campaignStatus === 'Paused') return 'Send paused'
  if (cancelReport.value) return 'Send cancelled'
  if (props.sendProgress?.done && props.sendProgress.campaignStatus === 'Paused') return 'Send paused'
  if (props.sendProgress?.done && props.sendProgress.campaignStatus === 'Cancelled') {
    return 'Send cancelled'
  }
  if (props.sendProgress?.done) return 'Send finished'
  if (props.sendProgress?.preparing) return `Preparing ${props.campaignName || 'campaign'}`
  return `Sending ${props.campaignName || 'campaign'}`
})

const isPreparingRecipients = computed(
  () =>
    !!props.sendProgress?.preparing &&
    !props.sendProgress.done &&
    props.sendProgress.processed === 0
)

const tabs: { id: CampaignSendRecipientReportStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' }
]

function statusBadgeClass(status?: string) {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
  if (status === 'failed') return 'bg-red-50 text-red-800 ring-red-200/70'
  if (status === 'sending') return 'bg-sky-50 text-sky-800 ring-sky-200/70'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-700 ring-slate-200/70'
  return 'bg-amber-50 text-amber-800 ring-amber-200/70'
}

async function executePause() {
  const id = props.campaignId
  if (!id || stopBusy.value) return
  stopBusy.value = true
  try {
    cancelReport.value = await pauseSendingCampaign(id)
  } finally {
    stopBusy.value = false
  }
}

async function executeCancel() {
  const id = props.campaignId
  if (!id || stopBusy.value) return
  stopBusy.value = true
  try {
    cancelReport.value = await cancelSendingCampaign(id)
  } finally {
    stopBusy.value = false
  }
}

function resetStopState() {
  stopBusy.value = false
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
    if (tab === 'all') return props.sendProgress.total
  }
  if (!c) return null
  if (tab === 'sent') return c.sent
  if (tab === 'pending') return c.pending
  if (tab === 'failed') return c.failed
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
      resetStopState()
    }
  },
  { immediate: true }
)

watch(
  () =>
    props.sendProgress
      ? `${props.sendProgress.sent}|${props.sendProgress.sending ?? 0}|${props.sendProgress.failed}|${props.sendProgress.remaining}|${props.sendProgress.processed}`
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
              v-if="props.sendProgress && !props.sendProgress.done"
              class="h-5 w-5 shrink-0 animate-spin text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 id="send-progress-modal-title" class="truncate text-lg font-semibold text-slate-900">
              {{ modalTitle }}
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
            <div
              v-if="cancelReport"
              class="rounded-xl border px-4 py-3 text-sm"
              :class="
                cancelReport.campaignStatus === 'Paused'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-rose-200 bg-rose-50 text-rose-950'
              "
            >
              <p class="font-medium">
                {{
                  cancelReport.campaignStatus === 'Paused'
                    ? 'Campaign send paused.'
                    : 'Campaign send stopped.'
                }}
              </p>
              <p class="mt-1" :class="cancelReport.campaignStatus === 'Paused' ? 'text-amber-900/90' : 'text-rose-900/90'">
                {{ cancelReport.counts.sent }} sent · {{ cancelReport.counts.notSent }} not sent.
                Messages already submitted to the email provider may still deliver.
              </p>
            </div>

            <div v-if="cancelReport" class="grid gap-4 md:grid-cols-2">
              <section class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <h4 class="text-sm font-semibold text-slate-900">
                  Sent ({{ cancelReport.counts.sent }})
                </h4>
                <ul class="mt-2 max-h-40 overflow-y-auto text-sm">
                  <li
                    v-for="r in cancelReport.sentRecipients"
                    :key="`sent-${r.email}`"
                    class="border-b border-slate-100 py-1.5 last:border-0"
                  >
                    {{ r.email }}
                  </li>
                  <li v-if="cancelReport.sentRecipients.length === 0" class="py-2 text-slate-500">
                    No recipients were sent before cancellation.
                  </li>
                </ul>
              </section>
              <section class="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <h4 class="text-sm font-semibold text-slate-900">
                  Not sent ({{ cancelReport.counts.notSent }})
                </h4>
                <ul class="mt-2 max-h-40 overflow-y-auto text-sm">
                  <li
                    v-for="r in cancelReport.notSentRecipients"
                    :key="`not-${r.email}-${r.status}`"
                    class="border-b border-slate-100 py-1.5 last:border-0"
                  >
                    {{ r.email }}
                    <span class="ml-2 text-xs uppercase text-slate-500">{{ r.status }}</span>
                  </li>
                  <li v-if="cancelReport.notSentRecipients.length === 0" class="py-2 text-slate-500">
                    All recipients were sent before cancellation.
                  </li>
                </ul>
              </section>
            </div>

            <div>
              <p class="text-base font-medium text-slate-900">
                <template v-if="props.sendProgress.done">
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} processed
                </template>
                <template v-else-if="isPreparingRecipients">
                  Preparing {{ props.sendProgress.total.toLocaleString() }} recipients…
                </template>
                <template v-else>
                  {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} — sending
                </template>
              </p>
              <p
                v-if="isPreparingRecipients"
                class="mt-1 text-xs text-slate-600"
              >
                Building the recipient list. Sending starts automatically when ready.
              </p>
              <p
                v-else-if="!props.sendProgress.done && (props.sendProgress.inFlight ?? props.sendProgress.sending)"
                class="mt-1 text-xs text-sky-700"
              >
                {{ props.sendProgress.inFlight ?? props.sendProgress.sending }} in flight at Brevo
              </p>
              <div class="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  class="h-full rounded-full bg-slate-900 transition-all duration-700 ease-out"
                  :style="{ width: `${props.sendProgress.pct}%` }"
                />
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.sent }}</div>
                  <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Sent</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <div class="text-lg font-bold tabular-nums text-sky-900">
                    {{ props.sendProgress.inFlight ?? props.sendProgress.sending ?? 0 }}
                  </div>
                  <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">In flight</div>
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
                      ? 'bg-indigo-600 text-white ring-indigo-600'
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

              <label class="mt-3 block">
                <span class="sr-only">Search recipients</span>
                <input
                  v-model="reportSearch"
                  type="search"
                  placeholder="Search email…"
                  class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
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
                  class="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-slate-900">{{ row.email }}</div>
                    <p
                      v-if="row.status === 'failed' && row.error"
                      class="mt-0.5 truncate text-xs text-red-600"
                      :title="row.error"
                    >
                      {{ row.error }}
                    </p>
                    <p v-else-if="row.brevoLastEvent" class="mt-0.5 text-xs text-sky-700">
                      {{ row.brevoLastEvent }}
                      <span v-if="row.brevoLastEventAt" class="text-slate-400">
                        · {{ new Date(row.brevoLastEventAt).toLocaleString() }}
                      </span>
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
                    {{ row.status }}
                  </span>
                </li>
              </ul>
              <p v-else-if="isPreparingRecipients" class="mt-4 text-sm text-slate-500">
                Recipient list is being prepared…
              </p>
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

        <div
          v-if="canShowStop && !cancelReport"
          class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6"
        >
          <button
            type="button"
            class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100 disabled:opacity-50"
            :disabled="stopBusy"
            @click="executePause"
          >
            {{ stopBusy ? 'Stopping…' : 'Pause' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
            :disabled="stopBusy"
            @click="executeCancel"
          >
            {{ stopBusy ? 'Stopping…' : 'Cancel send' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
