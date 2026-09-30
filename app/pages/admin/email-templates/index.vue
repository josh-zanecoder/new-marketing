<script setup lang="ts">
import type { AdminTenantRow } from '~/types/adminTenant'

definePageMeta({ layout: 'admin' })

type AdminEmailTemplateCampaign = {
  id: string
  name: string
  status: string
}

type AdminEmailTemplateRow = {
  id: string
  tenantDbName: string
  tenantName: string
  name: string
  subject: string
  htmlSource: string
  inLibrary: boolean
  updatedAt: string
  campaignCount: number
  campaigns: AdminEmailTemplateCampaign[]
}

type AdminEmailTemplatesResponse = {
  templates: AdminEmailTemplateRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_SIZE = 25

const searchQuery = ref('')
const searchDebounced = ref('')
const tenantFilter = ref('')
const page = ref(1)
const tenants = ref<AdminTenantRow[]>([])
const previewOpen = ref(false)
const previewName = ref('')
const previewSubject = ref('')
const previewHtml = ref('')
const previewPending = ref(false)
const previewError = ref('')

const tenantFilterSelectOptions = computed(() => [
  { value: '', label: 'All tenants' },
  ...tenants.value.map((t) => ({ value: t.dbName, label: t.name }))
])

const requestKey = computed(() =>
  JSON.stringify({
    page: page.value,
    tenant: tenantFilter.value,
    search: searchDebounced.value.trim()
  })
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchDebounced.value = value
    page.value = 1
  }, 300)
})

watch(tenantFilter, () => {
  page.value = 1
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

await useAsyncData('admin-email-templates-tenants', async () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  const res = await reqFetch<{ tenants: AdminTenantRow[] }>('/api/v1/admin/tenants', {
    credentials: 'include'
  })
  tenants.value = res.tenants ?? []
  return true
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-email-templates',
  () => {
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    return reqFetch<AdminEmailTemplatesResponse>('/api/v1/admin/email-templates', {
      credentials: 'include',
      query: {
        page: page.value,
        limit: PAGE_SIZE,
        tenantDbName: tenantFilter.value || undefined,
        search: searchDebounced.value.trim() || undefined
      }
    })
  },
  { watch: [requestKey] }
)

const templates = computed(() => data.value?.templates ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)

const loadError = computed(() => {
  if (!error.value) return ''
  const err = error.value as {
    data?: { message?: string; statusMessage?: string }
    statusMessage?: string
    message?: string
  }
  return (
    err.data?.message
    || err.data?.statusMessage
    || err.statusMessage
    || err.message
    || 'Unable to load templates.'
  )
})

const paginationMeta = computed(() => {
  if (!total.value) return { from: 0, to: 0, total: 0 }
  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, total.value)
  return { from, to, total: total.value }
})

function formatUpdated(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function showTenantHeading(index: number): boolean {
  const row = templates.value[index]
  if (!row) return false
  if (index === 0) return true
  return templates.value[index - 1]?.tenantDbName !== row.tenantDbName
}

function campaignPath(row: AdminEmailTemplateRow, campaignId: string): string {
  return `/admin/campaigns/${encodeURIComponent(row.tenantDbName)}/${encodeURIComponent(campaignId)}`
}

function extraCampaignCount(row: AdminEmailTemplateRow): number {
  return Math.max(0, row.campaignCount - row.campaigns.length)
}

async function openPreview(row: AdminEmailTemplateRow) {
  previewOpen.value = true
  previewPending.value = true
  previewError.value = ''
  previewName.value = row.name
  previewSubject.value = row.subject
  previewHtml.value = ''
  try {
    const reqFetch = import.meta.server ? useRequestFetch() : $fetch
    const res = await reqFetch<{ name: string; subject: string; html: string }>(
      '/api/v1/admin/email-templates/preview',
      {
        credentials: 'include',
        query: { tenantDbName: row.tenantDbName, id: row.id }
      }
    )
    previewName.value = res.name || row.name
    previewSubject.value = res.subject || row.subject
    previewHtml.value = res.html || ''
  } catch (e) {
    const err = e as { data?: { message?: string }; message?: string }
    previewError.value = err.data?.message || err.message || 'Could not load this preview.'
  } finally {
    previewPending.value = false
  }
}

function closePreview() {
  previewOpen.value = false
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="page-eyebrow">Library</p>
        <h1 class="page-title">Templates</h1>
        <p class="page-lead">
          Live email designs for every tenant, with the campaigns that used each one.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        :disabled="pending"
        @click="refresh()"
      >
        Refresh
      </button>
    </header>

    <div class="flex flex-col gap-3 sm:flex-row">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search name or subject…"
        class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:max-w-sm"
      >
      <select
        v-model="tenantFilter"
        class="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 sm:max-w-xs"
      >
        <option v-for="opt in tenantFilterSelectOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <p v-if="pending" class="text-sm text-slate-500">Loading templates…</p>
    <div
      v-else-if="loadError"
      class="rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900"
      role="alert"
    >
      {{ loadError }}
    </div>
    <p v-else-if="!templates.length" class="text-sm text-slate-500">
      No templates match this view.
    </p>

    <div v-else class="space-y-8">
      <template v-for="(row, index) in templates" :key="`${row.tenantDbName}-${row.id}`">
        <h2
          v-if="showTenantHeading(index)"
          class="text-sm font-semibold uppercase tracking-wider text-slate-500"
        >
          {{ row.tenantName }}
        </h2>
        <article class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h3 class="truncate text-base font-semibold text-slate-900">{{ row.name }}</h3>
              <p class="mt-1 text-sm text-slate-600">
                <span class="font-medium text-slate-700">Subject:</span>
                {{ row.subject.trim() || 'No subject' }}
              </p>
              <p class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {{ row.inLibrary ? 'In library' : 'Campaign only' }}
                </span>
                <span>Updated {{ formatUpdated(row.updatedAt) }}</span>
              </p>
            </div>
            <button
              type="button"
              class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
              @click="openPreview(row)"
            >
              Preview
            </button>
          </div>
          <div class="mt-4 border-t border-slate-100 pt-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Used by
            </p>
            <p v-if="!row.campaignCount" class="mt-1 text-sm text-slate-500">
              No campaigns yet.
            </p>
            <ul v-else class="mt-2 space-y-1">
              <li v-for="campaign in row.campaigns" :key="campaign.id">
                <NuxtLink
                  :to="campaignPath(row, campaign.id)"
                  class="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  {{ campaign.name }}
                </NuxtLink>
                <span v-if="campaign.status" class="ml-2 text-xs text-slate-500">{{ campaign.status }}</span>
              </li>
            </ul>
            <p v-if="extraCampaignCount(row)" class="mt-2 text-xs text-slate-500">
              +{{ extraCampaignCount(row) }} more
            </p>
          </div>
        </article>
      </template>
    </div>

    <div
      v-if="!pending && !loadError && total > PAGE_SIZE"
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-slate-500">
        {{ paginationMeta.from }}–{{ paginationMeta.to }} of {{ paginationMeta.total }}
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40"
          :disabled="page <= 1"
          @click="page -= 1"
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40"
          :disabled="page >= totalPages"
          @click="page += 1"
        >
          Next
        </button>
      </div>
    </div>

    <div
      v-if="previewOpen && previewPending"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40"
      role="status"
    >
      <p class="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg">
        Loading preview…
      </p>
    </div>
    <div
      v-if="previewOpen && previewError"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-slate-900/40" @click="closePreview" />
      <div class="relative m-4 max-w-sm rounded-2xl border border-red-200 bg-white p-5 shadow-xl">
        <p class="text-sm text-red-900">{{ previewError }}</p>
        <button
          type="button"
          class="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
          @click="closePreview"
        >
          Close
        </button>
      </div>
    </div>
    <TenantEmailTemplatePreviewModal
      :open="previewOpen && !previewPending && !previewError"
      :name="previewName"
      :subject="previewSubject"
      :html="previewHtml"
      @close="closePreview"
    />
  </div>
</template>
