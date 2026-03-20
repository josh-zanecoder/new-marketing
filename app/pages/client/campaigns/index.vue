<script setup lang="ts">
import type { Campaign, SendStatus } from '~/types/campaign'
import { useCampaignStore } from '~/store/campaignStore'

const store = useCampaignStore()
const { campaigns, sendingCampaignId, sendStatus, sendError } = storeToRefs(store)

const searchQuery = ref('')
const statusFilter = ref<string>('all')
const campaignToDelete = ref<Campaign | null>(null)
const campaignToDuplicate = ref<Campaign | null>(null)

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

function recipientCount(c: Campaign): string | number {
  if (c.recipientsType === 'manual') return c.recipients?.length ?? 0
  return c.recipientsListId ? 'List' : '–'
}

let pollTimer: ReturnType<typeof setTimeout> | null = null

async function handleSend(c: Campaign) {
  if (c.status !== 'Draft') return
  if (!c.recipients?.length && c.recipientsType === 'manual') return
  const ok = await store.sendCampaign(c)
  if (ok) startPolling(c.id)
}

function startPolling(campaignId: string) {
  async function poll() {
    if (!sendingCampaignId.value) return
    try {
      const res = await $fetch<SendStatus>(`/api/v1/send-campaign/status/${campaignId}`, {
        timeout: 60000
      })
      store.setSendStatus(res)
      if (res.done) {
        store.setSendingCampaignId(null)
        if (pollTimer) clearInterval(pollTimer)
        await store.fetchCampaigns()
      }
    } catch {
      store.clearSendModal()
      if (pollTimer) clearInterval(pollTimer)
    }
  }
  poll()
  pollTimer = setInterval(poll, 5000)
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
  if (newId) await navigateTo(`/client/campaigns/add?id=${newId}`)
}

function closeSendModal() {
  store.clearSendModal()
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] lg:px-8">
      <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Campaigns</h1>
        <NuxtLink
          to="/client/campaigns/add"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create campaign
        </NuxtLink>
      </header>

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search campaigns"
            class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
        </div>
        <select
          v-model="statusFilter"
          class="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option value="all">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sending">Sending</option>
          <option value="Sent">Sent</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      <div v-if="!filteredCampaigns.length" class="rounded-xl border border-slate-200 bg-slate-50/50 px-8 py-20 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-200/80 text-slate-500">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="mt-4 text-lg font-semibold text-slate-900">No campaigns yet</h3>
        <p class="mt-1 text-sm text-slate-500">
          {{ campaigns.length ? 'No campaigns match your filters' : 'Create your first campaign to get started' }}
        </p>
        <NuxtLink
          v-if="!campaigns.length"
          to="/client/campaigns/add"
          class="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          Create campaign
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="c in filteredCampaigns"
          :key="c.id"
          class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:gap-6"
        >
          <NuxtLink :to="`/client/campaigns/${c.id}`" class="min-w-0 flex-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 block">
            <div class="min-w-0 flex-1">
              <span class="font-semibold text-slate-900 hover:text-slate-700">
                {{ c.name || 'Untitled' }}
              </span>
              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span
                  class="inline-flex rounded px-1.5 py-0.5 font-medium"
                  :class="{
                    'bg-amber-100 text-amber-700': c.status === 'Draft',
                    'bg-blue-100 text-blue-700': c.status === 'Scheduled' || c.status === 'Sending',
                    'bg-emerald-100 text-emerald-700': c.status === 'Sent',
                    'bg-red-100 text-red-700': c.status === 'Failed',
                    'bg-slate-100 text-slate-600': !['Draft','Scheduled','Sending','Sent','Failed'].includes(c.status)
                  }"
                >
                  {{ c.status }}
                </span>
                <span>#{{ c.id.slice(-6) }}</span>
                <span v-if="c.createdAt">{{ new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 sm:flex-1">
            <div>
              <div class="text-xs font-medium text-slate-400">Recipients</div>
              <div class="text-slate-700">{{ recipientCount(c) }}</div>
            </div>
            <div>
              <div class="text-xs font-medium text-slate-400">Opens</div>
              <div class="text-slate-500">–</div>
            </div>
            <div>
              <div class="text-xs font-medium text-slate-400">Clicks</div>
              <div class="text-slate-500">–</div>
            </div>
            <div>
              <div class="text-xs font-medium text-slate-400">Conversions</div>
              <div class="text-slate-500">–</div>
            </div>
            </div>
          </NuxtLink>
          <div class="flex items-center gap-1.5">
            <button
              v-if="c.status === 'Draft' && c.recipientsType === 'manual' && (c.recipients?.length ?? 0) > 0"
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!!sendingCampaignId"
              title="Send"
              @click="handleSend(c)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
            <button
              v-if="c.status === 'Sent'"
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Duplicate campaign"
              @click.stop="openDuplicateModal(c)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete campaign"
              @click.stop="openDeleteModal(c)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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

    <!-- Send progress modal -->
    <Teleport to="body">
      <div
        v-if="sendingCampaignId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        @click.self="closeSendModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-slate-900">
              Sending {{ campaigns.find(x => x.id === sendingCampaignId)?.name || 'campaign' }}
            </h3>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              @click="closeSendModal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div v-if="sendError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ sendError }}
          </div>
          <div v-else-if="sendStatus" class="space-y-5">
            <div class="flex gap-6 text-sm">
              <span class="flex items-center gap-1.5 text-amber-600 font-medium">
                <span class="h-2 w-2 rounded-full bg-amber-500" /> Pending: {{ sendStatus.pending }}
              </span>
              <span class="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span class="h-2 w-2 rounded-full bg-emerald-500" /> Sent: {{ sendStatus.sent }}
              </span>
              <span class="flex items-center gap-1.5 text-red-600 font-medium">
                <span class="h-2 w-2 rounded-full bg-red-500" /> Failed: {{ sendStatus.failed }}
              </span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                class="h-full rounded-full bg-slate-700 transition-all duration-500 ease-out"
                :style="{ width: sendStatus.total ? `${((sendStatus.sent + sendStatus.failed) / sendStatus.total) * 100}%` : '0%' }"
              />
            </div>
            <p v-if="sendStatus.done" class="text-sm font-medium text-slate-700">
              Complete. Campaign status: {{ sendStatus.campaignStatus }}
            </p>
            <p v-else class="text-sm text-slate-500">
              Sending {{ sendStatus.pending }} remaining...
            </p>
          </div>
          <div v-else class="flex items-center gap-3 text-sm text-slate-500">
            <svg class="h-5 w-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting...
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
