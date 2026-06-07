<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="max-w-2xl text-sm leading-relaxed text-slate-600">
        Manage in-flight sends or review paused and cancelled campaigns with full delivery reports.
      </p>
      <div class="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading || actionLoading"
          @click="refreshCurrentTab"
        >
          Refresh
        </button>
        <button
          v-if="activeTab === 'sending'"
          type="button"
          class="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading || actionLoading || sendingTotal === 0"
          @click="openConfirmAll"
        >
          Cancel all sends
        </button>
      </div>
    </div>

    <nav class="flex gap-1 border-b border-slate-200/90" aria-label="Campaign send views">
      <button
        type="button"
        class="-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors"
        :class="
          activeTab === 'sending'
            ? 'border-indigo-600 text-indigo-900'
            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
        "
        @click="switchTab('sending')"
      >
        In-flight
        <span v-if="sendingTotal > 0" class="ml-1.5 tabular-nums text-slate-500">({{ sendingTotal }})</span>
      </button>
      <button
        type="button"
        class="-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors"
        :class="
          activeTab === 'stopped'
            ? 'border-indigo-600 text-indigo-900'
            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
        "
        @click="switchTab('stopped')"
      >
        Stopped / Paused
        <span v-if="stoppedTotal > 0" class="ml-1.5 tabular-nums text-slate-500">({{ stoppedTotal }})</span>
      </button>
    </nav>

    <div
      v-if="errorMessage"
      class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <section v-show="activeTab === 'sending'" class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/90">
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign</th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</th>
              <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</th>
              <th class="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading && activeTab === 'sending'">
              <td colspan="4" class="px-4 py-10 text-center text-slate-500">
                Loading sending campaigns…
              </td>
            </tr>
            <tr v-else-if="campaigns.length === 0">
              <td colspan="4" class="px-4 py-10 text-center text-slate-500">
                No campaigns are currently sending for this tenant.
              </td>
            </tr>
            <tr
              v-for="row in campaigns"
              v-else
              :key="row.campaignId"
              class="transition-colors hover:bg-slate-50/80"
            >
              <td class="px-4 py-4 align-top">
                <p class="font-medium text-slate-900">{{ row.campaignName }}</p>
                <p class="mt-0.5 truncate text-slate-600" :title="row.subject">{{ row.subject || '—' }}</p>
                <p class="mt-1 font-mono text-xs text-slate-400">{{ row.campaignId }}</p>
              </td>
              <td class="px-4 py-4 align-top text-slate-700">
                <p><span class="font-semibold text-emerald-700">{{ row.counts.sent }}</span> sent</p>
                <p><span class="font-semibold text-amber-700">{{ row.counts.notSent }}</span> not sent</p>
                <p class="text-xs text-slate-500">
                  {{ row.counts.pending }} pending · {{ row.counts.sending }} sending ·
                  {{ row.counts.failed }} failed
                </p>
              </td>
              <td class="px-4 py-4 align-top text-slate-600">
                {{ formatWhen(row.updatedAt || row.startedAt) }}
              </td>
              <td class="px-4 py-4 align-top text-right">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                    :disabled="actionLoading"
                    @click="executePause(row)"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    :disabled="actionLoading"
                    @click="openConfirmOne(row)"
                  >
                    Cancel send
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminTablePagination
        :page="sendingPage"
        :total-pages="sendingTotalPages"
        :total="sendingTotal"
        :limit="CAMPAIGN_PAGE_LIMIT"
        :loading="loading"
        item-label="campaigns"
        @update:page="loadSendingPage"
      />
    </section>

    <section v-show="activeTab === 'stopped'" class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in stoppedStatusOptions"
          :key="option.value"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition sm:text-sm"
          :class="
            stoppedStatusFilter === option.value
              ? 'bg-indigo-600 text-white ring-indigo-600'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          "
          @click="setStoppedStatusFilter(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/90">
                <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Campaign</th>
                <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</th>
                <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</th>
                <th class="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</th>
                <th class="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading && activeTab === 'stopped'">
                <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                  Loading stopped campaigns…
                </td>
              </tr>
              <tr v-else-if="stoppedCampaigns.length === 0">
                <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                  No paused or cancelled campaigns with delivery records.
                </td>
              </tr>
              <tr
                v-for="row in stoppedCampaigns"
                v-else
                :key="`stopped-${row.campaignId}`"
                class="transition-colors hover:bg-slate-50/80"
              >
                <td class="px-4 py-4 align-top">
                  <p class="font-medium text-slate-900">{{ row.campaignName }}</p>
                  <p class="mt-0.5 truncate text-slate-600" :title="row.subject">{{ row.subject || '—' }}</p>
                  <p class="mt-1 font-mono text-xs text-slate-400">{{ row.campaignId }}</p>
                </td>
                <td class="px-4 py-4 align-top text-slate-700">
                  <p class="font-medium text-slate-900">{{ row.ownerName || '—' }}</p>
                  <p v-if="row.ownerEmail" class="text-xs text-slate-500">{{ row.ownerEmail }}</p>
                </td>
                <td class="px-4 py-4 align-top">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
                    :class="
                      row.campaignStatus === 'Paused'
                        ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
                        : 'bg-rose-50 text-rose-800 ring-rose-200/80'
                    "
                  >
                    {{ row.campaignStatus }}
                  </span>
                </td>
                <td class="px-4 py-4 align-top text-slate-700">
                  <p><span class="font-semibold text-emerald-700">{{ row.counts.sent }}</span> sent</p>
                  <p><span class="font-semibold text-amber-700">{{ row.counts.notSent }}</span> not sent</p>
                </td>
                <td class="px-4 py-4 align-top text-slate-600">
                  {{ formatWhen(row.updatedAt || row.startedAt) }}
                </td>
                <td class="px-4 py-4 align-top text-right">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    @click="openReport(row.campaignId)"
                  >
                    View report
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminTablePagination
          :page="stoppedPage"
          :total-pages="stoppedTotalPages"
          :total="stoppedTotal"
          :limit="CAMPAIGN_PAGE_LIMIT"
          :loading="loading"
          item-label="campaigns"
          @update:page="loadStoppedPage"
        />
      </div>
    </section>

    <div
      v-if="confirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="confirm-title" class="text-lg font-semibold text-slate-900">
          {{ confirmMode === 'all' ? 'Cancel all sending campaigns?' : 'Cancel this campaign send?' }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-600">
          <template v-if="confirmMode === 'all'">
            This will stop {{ sendingTotal }} in-flight send{{ sendingTotal === 1 ? '' : 's' }}
            for {{ tenantName }}. Queued recipients will be marked cancelled.
          </template>
          <template v-else-if="confirmTarget">
            Cancel <strong>{{ confirmTarget.campaignName }}</strong>?
          </template>
        </p>
        <p class="mt-2 text-xs text-slate-500">
          Messages already submitted to the email provider cannot be recalled.
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            :disabled="actionLoading"
            @click="closeConfirm"
          >
            Keep sending
          </button>
          <button
            type="button"
            class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            :disabled="actionLoading"
            @click="executeCancel"
          >
            {{ actionLoading ? 'Cancelling…' : 'Yes, cancel send' }}
          </button>
        </div>
      </div>
    </div>

    <AdminCampaignStopReportModal
      :open="reportOpen"
      :tenant-id="tenantId"
      :campaign-id="reportCampaignId"
      @close="closeReport"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  AdminCampaignListPage,
  AdminSendingCampaignRow,
  AdminStoppedCampaignRow,
  AdminStoppedCampaignStatusFilter
} from '~/types/adminSendingCampaign'

const props = defineProps<{
  tenantId: string
  tenantName: string
}>()

type SendTab = 'sending' | 'stopped'

const CAMPAIGN_PAGE_LIMIT = 10

const activeTab = ref<SendTab>('sending')
const campaigns = ref<AdminSendingCampaignRow[]>([])
const stoppedCampaigns = ref<AdminStoppedCampaignRow[]>([])
const sendingPage = ref(1)
const stoppedPage = ref(1)
const sendingTotal = ref(0)
const sendingTotalPages = ref(1)
const stoppedTotal = ref(0)
const stoppedTotalPages = ref(1)
const stoppedStatusFilter = ref<AdminStoppedCampaignStatusFilter>('all')
const loading = ref(true)
const actionLoading = ref(false)
const errorMessage = ref('')

const confirmOpen = ref(false)
const confirmMode = ref<'one' | 'all'>('one')
const confirmTarget = ref<AdminSendingCampaignRow | null>(null)

const reportOpen = ref(false)
const reportCampaignId = ref<string | null>(null)

const stoppedStatusOptions: { value: AdminStoppedCampaignStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Paused', label: 'Paused' },
  { value: 'Cancelled', label: 'Cancelled' }
]

const apiBase = computed(
  () => `/api/v1/admin/tenants/${encodeURIComponent(props.tenantId)}/sending-campaigns`
)

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

async function loadSendingPage(page = sendingPage.value, options?: { silent?: boolean }) {
  sendingPage.value = page
  if (!options?.silent) loading.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<AdminCampaignListPage<AdminSendingCampaignRow>>(apiBase.value, {
      method: 'GET',
      query: {
        view: 'sending',
        page,
        limit: CAMPAIGN_PAGE_LIMIT,
        ...(options?.silent ? { _t: Date.now() } : {})
      }
    })
    campaigns.value = res.items ?? []
    sendingPage.value = res.page
    sendingTotal.value = res.total
    sendingTotalPages.value = res.totalPages
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load sending campaigns'
    if (!options?.silent) {
      campaigns.value = []
      sendingTotal.value = 0
      sendingTotalPages.value = 1
    }
  } finally {
    if (!options?.silent) loading.value = false
  }
}

async function loadStoppedPage(page = stoppedPage.value, options?: { silent?: boolean }) {
  stoppedPage.value = page
  if (!options?.silent) loading.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<AdminCampaignListPage<AdminStoppedCampaignRow>>(apiBase.value, {
      method: 'GET',
      query: {
        view: 'stopped',
        page,
        limit: CAMPAIGN_PAGE_LIMIT,
        status: stoppedStatusFilter.value,
        ...(options?.silent ? { _t: Date.now() } : {})
      }
    })
    stoppedCampaigns.value = res.items ?? []
    stoppedPage.value = res.page
    stoppedTotal.value = res.total
    stoppedTotalPages.value = res.totalPages
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load stopped campaigns'
    if (!options?.silent) {
      stoppedCampaigns.value = []
      stoppedTotal.value = 0
      stoppedTotalPages.value = 1
    }
  } finally {
    if (!options?.silent) loading.value = false
  }
}

async function refreshCurrentTab(options?: { silent?: boolean }) {
  if (activeTab.value === 'stopped') {
    await loadStoppedPage(stoppedPage.value, options)
    return
  }
  await loadSendingPage(sendingPage.value, options)
}

async function refreshAll(options?: { silent?: boolean }) {
  await Promise.all([
    loadSendingPage(sendingPage.value, options),
    loadStoppedPage(stoppedPage.value, options)
  ])
}

function switchTab(tab: SendTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (tab === 'stopped' && stoppedCampaigns.value.length === 0 && stoppedTotal.value === 0) {
    void loadStoppedPage(1)
  }
}

function setStoppedStatusFilter(value: AdminStoppedCampaignStatusFilter) {
  if (stoppedStatusFilter.value === value) return
  stoppedStatusFilter.value = value
  stoppedPage.value = 1
  void loadStoppedPage(1)
}

function formatFetchError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const o = err as { data?: { message?: string }; statusMessage?: string; message?: string }
    if (typeof o.data?.message === 'string' && o.data.message.trim()) return o.data.message
    if (typeof o.statusMessage === 'string' && o.statusMessage.trim()) return o.statusMessage
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

function openConfirmOne(row: AdminSendingCampaignRow) {
  confirmMode.value = 'one'
  confirmTarget.value = row
  confirmOpen.value = true
}

function openConfirmAll() {
  confirmMode.value = 'all'
  confirmTarget.value = null
  confirmOpen.value = true
}

function closeConfirm(force = false) {
  if (!force && actionLoading.value) return
  confirmOpen.value = false
  confirmTarget.value = null
}

function openReport(campaignId: string) {
  reportCampaignId.value = campaignId
  reportOpen.value = true
}

function closeReport() {
  reportOpen.value = false
  reportCampaignId.value = null
  void refreshAll({ silent: true })
}

async function executePause(row: AdminSendingCampaignRow) {
  actionLoading.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${apiBase.value}/${encodeURIComponent(row.campaignId)}/pause`, {
      method: 'POST',
      body: { confirm: true }
    })
    activeTab.value = 'stopped'
    stoppedPage.value = 1
    await refreshAll({ silent: true })
    openReport(row.campaignId)
  } catch (err: unknown) {
    errorMessage.value = formatFetchError(err, 'Pause failed')
    await refreshAll({ silent: true })
  } finally {
    actionLoading.value = false
  }
}

async function executeCancel() {
  actionLoading.value = true
  errorMessage.value = ''
  const mode = confirmMode.value
  const target = confirmTarget.value
  try {
    if (mode === 'all') {
      const res = await $fetch<{ reports: Array<{ campaignId: string }> }>(`${apiBase.value}/cancel-all`, {
        method: 'POST',
        body: { confirm: true }
      })
      activeTab.value = 'stopped'
      stoppedPage.value = 1
      await refreshAll({ silent: true })
      const firstId = res.reports?.[0]?.campaignId
      if (firstId) openReport(firstId)
    } else if (target) {
      await $fetch(`${apiBase.value}/${encodeURIComponent(target.campaignId)}/cancel`, {
        method: 'POST',
        body: { confirm: true }
      })
      activeTab.value = 'stopped'
      stoppedPage.value = 1
      await refreshAll({ silent: true })
      openReport(target.campaignId)
    }
  } catch (err: unknown) {
    errorMessage.value = formatFetchError(err, 'Cancellation failed')
    await refreshAll({ silent: true })
  } finally {
    actionLoading.value = false
    closeConfirm(true)
  }
}

watch(
  () => props.tenantId,
  (tenantId) => {
    if (!tenantId) return
    activeTab.value = 'sending'
    sendingPage.value = 1
    stoppedPage.value = 1
    stoppedStatusFilter.value = 'all'
    void loadSendingPage(1)
    void loadStoppedPage(1, { silent: true })
  },
  { immediate: true }
)
</script>
