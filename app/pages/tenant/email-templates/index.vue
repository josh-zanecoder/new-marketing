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

const EMAIL_TEMPLATES_CACHE_KEY = 'tenant-email-templates-index'

const subjectFilterSelectOptions = [
  { value: 'all', label: 'All templates' },
  { value: 'with-subject', label: 'With default subject' },
  { value: 'without-subject', label: 'Without subject' }
]

const sortBySelectOptions = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' }
]

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

function editTemplateHref(templateId: string): string {
  return `/tenant/email-templates/add?templateId=${encodeURIComponent(templateId)}`
}

function openPreview(template: EmailTemplateListRow) {
  previewTemplate.value = template
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewTemplate.value = null
}

async function loadTemplates(options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = readNuxtPayloadCache(EMAIL_TEMPLATES_CACHE_KEY, useNuxtApp()) as
      | EmailTemplateListRow[]
      | undefined
    if (Array.isArray(cached)) {
      templates.value = cached
      pending.value = false
      loadError.value = ''
      return
    }
  }

  pending.value = true
  loadError.value = ''
  try {
    const res = await marketingApi.fetchEmailTemplates()
    templates.value = (res.templates ?? []) as EmailTemplateListRow[]
    useNuxtApp().payload.data[EMAIL_TEMPLATES_CACHE_KEY] = templates.value
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
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Content</p>
        <h1 class="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          Email templates
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          Create templates by pasting or uploading HTML, preview them full size, and start a campaign from any template.
        </p>
      </div>
      <div class="flex items-center gap-2 sm:shrink-0">
        <NuxtLink
          to="/tenant/email-templates/add"
          class="btn-cta"
        >
          Create template
        </NuxtLink>
        <TenantRefreshIconButton
          aria-label="Refresh email templates"
          :pending="pending"
          @click="() => loadTemplates({ force: true })"
        />
      </div>
    </header>

    <div
      v-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      {{ loadError }}
    </div>

    <div class="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
      <div class="min-w-0 flex-1">
        <label class="sr-only" for="email-templates-search">Search templates</label>
        <div class="relative">
          <svg class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="email-templates-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search by name or subject…"
            class="w-full rounded-xl border border-slate-200/90 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:py-3.5 sm:text-[0.9375rem]"
          >
        </div>
      </div>
      <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:items-center">
        <TenantFilterSelect
          id="email-templates-subject-filter"
          v-model="subjectFilter"
          label="Subject filter"
          :options="subjectFilterSelectOptions"
          class="w-full shrink-0 lg:w-[14rem]"
        />
        <TenantFilterSelect
          id="email-templates-sort"
          v-model="sortBy"
          label="Sort templates"
          :options="sortBySelectOptions"
          class="w-full shrink-0 lg:w-[14rem]"
        />
      </div>
    </div>

    <div v-if="pending" class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
      <div
        v-for="n in 6"
        :key="n"
        class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <div class="aspect-[4/3] animate-pulse bg-slate-100" />
        <div class="space-y-2 p-4 sm:p-5">
          <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div class="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>

    <div
      v-else-if="!templates.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center shadow-sm sm:px-6 sm:py-20"
    >
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="mt-6 text-lg font-semibold text-slate-900">
        No templates yet
      </h3>
      <p class="mt-2 max-w-sm text-sm text-slate-500">
        Paste or upload HTML to create your first template.
      </p>
      <NuxtLink
        to="/tenant/email-templates/add"
        class="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
      >
        Create template
      </NuxtLink>
    </div>

    <div
      v-else-if="!filteredTemplates.length"
      class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center shadow-sm sm:px-6 sm:py-16"
    >
      <h3 class="text-lg font-semibold text-slate-900">
        No matching templates
      </h3>
      <p class="mt-2 text-sm text-slate-500">
        Try a different search or filter.
      </p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        <article
          v-for="template in paginatedTemplates"
          :key="template.id"
          class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
        >
          <button
            type="button"
            class="group relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50 text-left transition-colors hover:bg-slate-100/80 active:bg-slate-100"
            :aria-label="`Enlarge preview of ${template.name}`"
            @click="openPreview(template)"
          >
            <TenantEmailTemplateThumbnail
              v-if="template.htmlTemplate?.trim()"
              :html="template.htmlTemplate"
              :title="`${template.name} thumbnail`"
              class="absolute inset-0"
            />
            <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">
              No preview
            </div>
            <span class="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/10">
              <span class="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm sm:static sm:px-3 sm:py-1.5 sm:text-xs sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <Maximize2 class="h-3.5 w-3.5" aria-hidden="true" />
                Enlarge
              </span>
            </span>
          </button>
          <div class="flex flex-1 flex-col p-4 sm:p-5">
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
            <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 sm:w-auto"
                @click="openPreview(template)"
              >
                <Maximize2 class="h-4 w-4" aria-hidden="true" />
                Preview
              </button>
              <NuxtLink
                :to="editTemplateHref(template.id)"
                class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 sm:w-auto"
              >
                Edit
              </NuxtLink>
              <NuxtLink
                :to="makeCampaignHref(template.id)"
                class="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 sm:w-auto"
              >
                <Megaphone class="h-4 w-4 shrink-0" aria-hidden="true" />
                Make campaign
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="filteredTemplates.length > PAGE_SIZE"
        class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4"
      >
        <p class="min-w-0 text-xs tabular-nums text-slate-500 sm:text-sm">
          <span class="font-semibold text-slate-800">{{ paginationMeta.from }}–{{ paginationMeta.to }}</span>
          <span class="text-slate-300"> / </span>
          <span>{{ paginationMeta.total.toLocaleString() }}</span>
        </p>
        <nav
          class="flex shrink-0 items-center gap-1 sm:gap-1.5"
          aria-label="Email templates pagination"
        >
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-40 sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
            :disabled="currentPage === 1"
            @click="currentPage -= 1"
          >
            <span class="sm:hidden">Prev</span>
            <span class="hidden sm:inline">Previous</span>
          </button>
          <span class="whitespace-nowrap px-1 text-center text-xs font-medium tabular-nums text-slate-500 sm:min-w-[6.5rem] sm:text-sm">
            <span class="sm:hidden">{{ currentPage }}/{{ totalPages }}</span>
            <span class="hidden sm:inline">Page {{ currentPage }} / {{ totalPages }}</span>
          </span>
          <button
            type="button"
            class="inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm disabled:opacity-40 sm:h-auto sm:min-w-[5.5rem] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
            :disabled="currentPage === totalPages"
            @click="currentPage += 1"
          >
            Next
          </button>
        </nav>
      </div>
    </template>

    <TenantEmailTemplatePreviewModal
      :open="previewOpen"
      :name="previewTemplate?.name ?? ''"
      :subject="previewTemplate?.subject"
      :html="previewTemplate?.htmlTemplate ?? ''"
      :template-id="previewTemplate?.id"
      @close="closePreview"
    />
  </div>
</template>
