<script setup lang="ts">
import { Megaphone, Maximize2 } from 'lucide-vue-next'
import type { TenantEmailTemplateRow } from '~/composables/useTenantMarketingApi'

definePageMeta({ layout: 'default' })

type EmailTemplateListRow = TenantEmailTemplateRow & {
  description?: string
  createdAt?: string | null
  updatedAt?: string | null
}

type SortOption = 'recent' | 'name-asc' | 'name-desc'
type SubjectFilter = 'all' | 'with-subject' | 'without-subject'

const marketingApi = useTenantMarketingApi()
const PAGE_SIZE = 12

const pending = ref(true)
const loadError = ref('')
const templates = ref<EmailTemplateListRow[]>([])
const searchQuery = ref('')
const sortBy = ref<SortOption>('recent')
const subjectFilter = ref<SubjectFilter>('all')
const currentPage = ref(1)

const previewOpen = ref(false)
const previewTemplate = ref<EmailTemplateListRow | null>(null)

function previewSrcdoc(html: string, scale = 0.165) {
  return `<!DOCTYPE html><html><head><meta charset=utf-8><style>
*{box-sizing:border-box}
body{margin:0;padding:16px 8px;overflow:hidden;background:linear-gradient(135deg,#f8f4ef 0%,#f0e8df 100%);min-height:100%;display:flex;justify-content:center;align-items:flex-start}
#preview-wrap{transform:scale(${scale});transform-origin:top center;width:520px;max-width:100%}
</style></head><body><div id=preview-wrap>${html}</div></body></html>`
}

function formatUpdated(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return '—'
  }
}

const filteredTemplates = computed(() => {
  let list = [...templates.value]
  const subject = subjectFilter.value
  if (subject === 'with-subject') {
    list = list.filter((t) => Boolean(t.subject?.trim()))
  } else if (subject === 'without-subject') {
    list = list.filter((t) => !t.subject?.trim())
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((t) => {
      const blob = [t.name, t.subject, t.description].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  }
  if (sortBy.value === 'name-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'name-desc') {
    list.sort((a, b) => b.name.localeCompare(a.name))
  } else {
    list.sort((a, b) => {
      const aMs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bMs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bMs - aMs
    })
  }
  return list
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredTemplates.value.length / PAGE_SIZE))
)

const paginatedTemplates = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredTemplates.value.slice(start, start + PAGE_SIZE)
})

const paginationMeta = computed(() => {
  const total = filteredTemplates.value.length
  if (!total) return { from: 0, to: 0, total: 0 }
  const from = (currentPage.value - 1) * PAGE_SIZE + 1
  const to = Math.min(currentPage.value * PAGE_SIZE, total)
  return { from, to, total }
})

watch([searchQuery, sortBy, subjectFilter], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

function makeCampaignHref(templateId: string): string {
  return `/tenant/campaigns/add?templateId=${encodeURIComponent(templateId)}`
}

function openPreview(template: EmailTemplateListRow) {
  previewTemplate.value = template
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewTemplate.value = null
}

async function loadTemplates() {
  pending.value = true
  loadError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplates()
    templates.value = (res.templates ?? []) as EmailTemplateListRow[]
  } catch (e: unknown) {
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load templates')
        : 'Failed to load templates'
    templates.value = []
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div class="w-full min-w-0 space-y-8 antialiased">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Email templates
      </h1>
      <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
        Browse saved designs, preview them full size, and start a campaign from any template.
      </p>
    </header>

    <div
      v-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      {{ loadError }}
    </div>

    <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-3">
      <div class="relative min-w-0 w-full max-w-lg">
        <label class="sr-only" for="email-templates-search">Search templates</label>
        <svg class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="email-templates-search"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          placeholder="Search by name or subject…"
          class="w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-11 pr-4 text-[0.9375rem] text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
      </div>
      <div class="relative w-full shrink-0 sm:w-[14rem]">
        <label class="sr-only" for="email-templates-subject-filter">Subject filter</label>
        <select
          id="email-templates-subject-filter"
          v-model="subjectFilter"
          class="h-full w-full min-h-[2.875rem] cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-[0.9375rem] font-medium text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
          <option value="all">
            All templates
          </option>
          <option value="with-subject">
            With default subject
          </option>
          <option value="without-subject">
            Without subject
          </option>
        </select>
        <svg class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div class="relative w-full shrink-0 sm:w-[14rem]">
        <label class="sr-only" for="email-templates-sort">Sort</label>
        <select
          id="email-templates-sort"
          v-model="sortBy"
          class="h-full w-full min-h-[2.875rem] cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-[0.9375rem] font-medium text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
        >
          <option value="recent">
            Recently updated
          </option>
          <option value="name-asc">
            Name A–Z
          </option>
          <option value="name-desc">
            Name Z–A
          </option>
        </select>
        <svg class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <div v-if="pending" class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="n in 6"
        :key="n"
        class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <div class="aspect-[4/3] animate-pulse bg-slate-100" />
        <div class="space-y-2 p-5">
          <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div class="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>

    <div
      v-else-if="!templates.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-sm"
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold text-slate-900">
        No templates yet
      </h3>
      <p class="mt-2 max-w-sm text-sm text-slate-500">
        Save a design from a campaign or sync templates from CRM to see them here.
      </p>
    </div>

    <div
      v-else-if="!filteredTemplates.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm"
    >
      <h3 class="text-lg font-semibold text-slate-900">
        No matching templates
      </h3>
      <p class="mt-2 text-sm text-slate-500">
        Try a different search or filter.
      </p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="template in paginatedTemplates"
          :key="template.id"
          class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
        >
          <button
            type="button"
            class="group relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50 text-left transition-colors hover:bg-slate-100/80"
            :aria-label="`Enlarge preview of ${template.name}`"
            @click="openPreview(template)"
          >
            <iframe
              v-if="template.htmlTemplate?.trim()"
              :srcdoc="previewSrcdoc(template.htmlTemplate)"
              :title="`${template.name} thumbnail`"
              class="pointer-events-none absolute inset-0 h-full w-full border-0"
              sandbox="allow-same-origin"
              tabindex="-1"
            />
            <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">
              No preview
            </div>
            <span class="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/10">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                <Maximize2 class="h-3.5 w-3.5" aria-hidden="true" />
                Enlarge
              </span>
            </span>
          </button>
          <div class="flex flex-1 flex-col p-5">
            <h2 class="truncate text-base font-semibold text-slate-900">
              {{ template.name }}
            </h2>
            <p
              v-if="template.subject?.trim()"
              class="mt-1 truncate text-sm text-slate-500"
              :title="template.subject"
            >
              {{ template.subject }}
            </p>
            <p v-else class="mt-1 text-sm italic text-slate-400">
              No default subject
            </p>
            <p class="mt-2 text-xs text-slate-400">
              Updated {{ formatUpdated(template.updatedAt) }}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-800"
                @click="openPreview(template)"
              >
                <Maximize2 class="h-4 w-4" aria-hidden="true" />
                Preview
              </button>
              <NuxtLink
                :to="makeCampaignHref(template.id)"
                class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <Megaphone class="h-4 w-4" aria-hidden="true" />
                Make campaign
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="filteredTemplates.length > PAGE_SIZE"
        class="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <p class="tabular-nums text-slate-500">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="mx-1.5 text-slate-300">·</span>
          <span>{{ paginationMeta.total.toLocaleString() }} templates</span>
        </p>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            Previous
          </button>
          <span class="min-w-[6.5rem] px-1 text-center text-sm font-medium tabular-nums text-slate-500">
            Page {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            type="button"
            class="inline-flex min-w-[5.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </div>
      </div>
    </template>

    <TenantEmailTemplatePreviewModal
      :open="previewOpen"
      :name="previewTemplate?.name ?? ''"
      :subject="previewTemplate?.subject"
      :html="previewTemplate?.htmlTemplate ?? ''"
      @close="closePreview"
    />
  </div>
</template>
