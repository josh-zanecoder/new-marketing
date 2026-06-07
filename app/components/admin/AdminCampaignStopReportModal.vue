<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="admin-stop-report-title"
  >
    <div class="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div class="min-w-0">
          <h2 id="admin-stop-report-title" class="text-lg font-semibold text-slate-900">
            {{ reportTitle }}
          </h2>
          <p v-if="report" class="mt-1 truncate text-sm text-slate-600">
            {{ report.campaignName }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div v-if="reportLoading && !report" class="py-12 text-center text-sm text-slate-500">
          Loading report…
        </div>
        <div v-else-if="reportError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {{ reportError }}
        </div>
        <div v-else-if="report" class="space-y-5">
          <dl class="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
              <dd class="mt-1 text-sm font-medium text-slate-900">{{ report.campaignStatus }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Stopped at</dt>
              <dd class="mt-1 text-sm text-slate-900">{{ formatWhen(report.cancelledAt) }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</dt>
              <dd class="mt-1 text-sm text-slate-900">
                {{ report.campaign.ownerName || '—' }}
                <span v-if="report.campaign.ownerEmail" class="block text-xs text-slate-500">
                  {{ report.campaign.ownerEmail }}
                </span>
                <span v-if="report.campaign.ownerId" class="block font-mono text-xs text-slate-400">
                  {{ report.campaign.ownerId }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender</dt>
              <dd class="mt-1 text-sm text-slate-900">
                {{ report.campaign.senderName || '—' }}
                <span v-if="report.campaign.senderEmail" class="block text-xs text-slate-500">
                  {{ report.campaign.senderEmail }}
                </span>
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</dt>
              <dd class="mt-1 text-sm text-slate-900">{{ report.campaign.subject || '—' }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign ID</dt>
              <dd class="mt-1 font-mono text-xs text-slate-600">{{ report.campaignId }}</dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-2">
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              {{ report.counts.sent }} sent
            </span>
            <span class="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
              {{ report.counts.notSent }} not sent
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
              {{ report.counts.pending }} pending
            </span>
            <span class="rounded-full bg-red-50 px-3 py-1 text-sm text-red-800 ring-1 ring-red-100">
              {{ report.counts.failed }} failed
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200">
              {{ report.counts.cancelled }} cancelled
            </span>
          </div>

          <div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition sm:text-sm"
                :class="
                  recipientFilter === tab.id
                    ? 'bg-indigo-600 text-white ring-indigo-600'
                    : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                "
                @click="selectFilter(tab.id)"
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
                v-model="recipientSearch"
                type="search"
                placeholder="Search email…"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
              >
            </label>

            <div
              v-if="recipientsLoading && !recipientPage?.items.length"
              class="mt-4 flex items-center gap-2 text-sm text-slate-500"
            >
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading recipients…
            </div>
            <p v-else-if="recipientsError" class="mt-4 text-sm text-red-600">{{ recipientsError }}</p>
            <div v-else class="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table class="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead class="border-b border-slate-100 bg-slate-50/90">
                  <tr>
                    <th class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                    <th class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Sent at</th>
                    <th class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Detail</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(row, idx) in recipientPage?.items ?? []" :key="`${row.email}-${idx}`">
                    <td class="px-3 py-2.5 font-medium text-slate-900">{{ row.email }}</td>
                    <td class="px-3 py-2.5">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1"
                        :class="statusBadgeClass(row.status)"
                      >
                        {{ row.status }}
                      </span>
                    </td>
                    <td class="px-3 py-2.5 text-slate-600">{{ row.sentAt ? formatWhen(row.sentAt) : '—' }}</td>
                    <td class="max-w-xs truncate px-3 py-2.5 text-xs text-slate-500" :title="row.error">
                      {{ row.error || '—' }}
                    </td>
                  </tr>
                  <tr v-if="!(recipientPage?.items.length)">
                    <td colspan="4" class="px-3 py-8 text-center text-slate-500">
                      No recipients in this filter.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <AdminTablePagination
              v-if="recipientPage"
              :page="recipientPageNum"
              :total-pages="recipientPage.totalPages"
              :total="recipientPage.total"
              :limit="recipientPage.limit"
              :loading="recipientsLoading"
              item-label="recipients"
              @update:page="onRecipientPageChange"
            />
          </div>
        </div>
      </div>

      <div class="flex shrink-0 justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
        <button
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  AdminCampaignCancelReport,
  AdminCampaignReportRecipientFilter,
  AdminCampaignReportRecipientsPage
} from '~/types/adminSendingCampaign'

const props = defineProps<{
  open: boolean
  tenantId: string
  campaignId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const apiBase = computed(
  () => `/api/v1/admin/tenants/${encodeURIComponent(props.tenantId)}/sending-campaigns`
)

const report = ref<AdminCampaignCancelReport | null>(null)
const reportLoading = ref(false)
const reportError = ref('')

const recipientFilter = ref<AdminCampaignReportRecipientFilter>('all')
const recipientSearch = ref('')
const recipientPageNum = ref(1)
const recipientPage = ref<AdminCampaignReportRecipientsPage | null>(null)
const recipientsLoading = ref(false)
const recipientsError = ref('')

const REPORT_LIMIT = 25

const tabs: { id: AdminCampaignReportRecipientFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'notSent', label: 'Not sent' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' }
]

const reportTitle = computed(() => {
  if (!report.value) return 'Send report'
  return report.value.campaignStatus === 'Paused' ? 'Pause report' : 'Cancellation report'
})

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function statusBadgeClass(status?: string) {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/70'
  if (status === 'failed') return 'bg-red-50 text-red-800 ring-red-200/70'
  if (status === 'sending') return 'bg-sky-50 text-sky-800 ring-sky-200/70'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-700 ring-slate-200/70'
  return 'bg-amber-50 text-amber-800 ring-amber-200/70'
}

function tabCount(filter: AdminCampaignReportRecipientFilter): number | null {
  const c = recipientPage.value?.counts ?? report.value?.counts
  if (!c) return null
  if (filter === 'sent') return c.sent
  if (filter === 'notSent') return c.notSent
  if (filter === 'pending') return c.pending + c.sending
  if (filter === 'failed') return c.failed
  if (filter === 'cancelled') return c.cancelled
  return c.total
}

function selectFilter(filter: AdminCampaignReportRecipientFilter) {
  if (recipientFilter.value === filter) return
  recipientFilter.value = filter
  recipientPageNum.value = 1
  void loadRecipients()
}

function onRecipientPageChange(page: number) {
  recipientPageNum.value = page
  void loadRecipients()
}

async function loadReport() {
  const id = props.campaignId
  if (!id) return
  reportLoading.value = true
  reportError.value = ''
  try {
    const res = await $fetch<{ report: AdminCampaignCancelReport }>(
      `${apiBase.value}/${encodeURIComponent(id)}/report`,
      { method: 'GET' }
    )
    report.value = res.report
  } catch (err: unknown) {
    report.value = null
    reportError.value = err instanceof Error ? err.message : 'Failed to load report'
  } finally {
    reportLoading.value = false
  }
}

async function loadRecipients() {
  const id = props.campaignId
  if (!id) return
  recipientsLoading.value = true
  recipientsError.value = ''
  try {
    recipientPage.value = await $fetch<AdminCampaignReportRecipientsPage>(
      `${apiBase.value}/${encodeURIComponent(id)}/report`,
      {
        method: 'GET',
        query: {
          filter: recipientFilter.value,
          page: recipientPageNum.value,
          limit: REPORT_LIMIT,
          search: recipientSearch.value.trim() || undefined
        }
      }
    )
  } catch (err: unknown) {
    recipientPage.value = null
    recipientsError.value = err instanceof Error ? err.message : 'Failed to load recipients'
  } finally {
    recipientsLoading.value = false
  }
}

function resetState() {
  report.value = null
  reportError.value = ''
  recipientFilter.value = 'all'
  recipientSearch.value = ''
  recipientPageNum.value = 1
  recipientPage.value = null
  recipientsError.value = ''
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(
  () => recipientSearch.value,
  () => {
    if (!props.open) return
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      recipientPageNum.value = 1
      void loadRecipients()
    }, 350)
  }
)

watch(
  () => [props.open, props.campaignId] as const,
  async ([open, id]) => {
    if (open && id) {
      resetState()
      await loadReport()
      await loadRecipients()
    } else if (!open) {
      resetState()
    }
  },
  { immediate: true }
)
</script>
