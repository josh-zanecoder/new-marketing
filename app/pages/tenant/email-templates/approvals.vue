<script setup lang="ts">
import { Check, Maximize2, Megaphone, X } from 'lucide-vue-next'
import type { TenantEmailTemplateRow } from '~/composables/useTenantMarketingApi'

definePageMeta({ layout: 'default' })

const marketingApi = useTenantMarketingApi()
const toast = useAppToast()
const {
  allowTenantTemplateApproval,
  canSelectAnyLoanOfficer,
  loadDefaultCampaignSender,
  loaded: tenantFlagsLoaded
} = useDefaultCampaignSender()
void loadDefaultCampaignSender()

const { syncFromTemplatesLength } = usePendingEmailTemplateApprovalsCount()

const pending = ref(true)
const loadError = ref('')
const templates = ref<TenantEmailTemplateRow[]>([])
const searchQuery = ref('')
const actionId = ref('')
const previewOpen = ref(false)
const previewTemplate = ref<TenantEmailTemplateRow | null>(null)
const rejectOpen = ref(false)
const rejectTarget = ref<TenantEmailTemplateRow | null>(null)
const rejectReason = ref('')

const canAccess = computed(
  () =>
    tenantFlagsLoaded.value &&
    allowTenantTemplateApproval.value === true &&
    canSelectAnyLoanOfficer.value === true
)

const filteredTemplates = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return templates.value
  return templates.value.filter((row) => {
    const name = (row.name || '').toLowerCase()
    const subject = (row.subject || '').toLowerCase()
    const description = (row.description || '').toLowerCase()
    const from = creatorLabel(row).toLowerCase()
    return (
      name.includes(q) || subject.includes(q) || description.includes(q) || from.includes(q)
    )
  })
})

function formatSubmitted(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function creatorLabel(row: TenantEmailTemplateRow): string {
  return row.ownerEmail?.trim() || row.createdBy?.trim() || 'Unknown'
}

function makeCampaignHref(templateId: string): string {
  return `/tenant/campaigns/add?templateId=${encodeURIComponent(templateId)}`
}

async function loadApprovals() {
  if (!canAccess.value) {
    templates.value = []
    syncFromTemplatesLength(0)
    pending.value = false
    return
  }
  pending.value = true
  loadError.value = ''
  try {
    const res = await marketingApi.fetchPendingEmailTemplateApprovals()
    templates.value = Array.isArray(res.templates) ? res.templates : []
    syncFromTemplatesLength(templates.value.length)
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { message?: string } }).data?.message || '')
        : ''
    loadError.value = msg || 'Could not load pending approvals.'
    templates.value = []
  } finally {
    pending.value = false
  }
}

function openPreview(row: TenantEmailTemplateRow) {
  previewTemplate.value = row
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewTemplate.value = null
}

async function approve(row: TenantEmailTemplateRow) {
  if (actionId.value) return
  actionId.value = row.id
  try {
    await marketingApi.approveEmailTemplate(row.id)
    toast.success('Template approved')
    templates.value = templates.value.filter((t) => t.id !== row.id)
    syncFromTemplatesLength(templates.value.length)
    if (previewTemplate.value?.id === row.id) closePreview()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { message?: string } }).data?.message || '')
        : ''
    toast.error(msg || 'Could not approve template')
  } finally {
    actionId.value = ''
  }
}

function openReject(row: TenantEmailTemplateRow) {
  rejectTarget.value = row
  rejectReason.value = ''
  rejectOpen.value = true
}

function closeReject() {
  rejectOpen.value = false
  rejectTarget.value = null
  rejectReason.value = ''
}

async function confirmReject() {
  const row = rejectTarget.value
  if (!row || actionId.value) return
  actionId.value = row.id
  try {
    await marketingApi.rejectEmailTemplate(row.id, rejectReason.value)
    toast.success('Template rejected')
    templates.value = templates.value.filter((t) => t.id !== row.id)
    syncFromTemplatesLength(templates.value.length)
    closeReject()
    if (previewTemplate.value?.id === row.id) closePreview()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? String((err as { data?: { message?: string } }).data?.message || '')
        : ''
    toast.error(msg || 'Could not reject template')
  } finally {
    actionId.value = ''
  }
}

watch(canAccess, (ok) => {
  if (ok) void loadApprovals()
  else {
    pending.value = false
    templates.value = []
    syncFromTemplatesLength(0)
  }
})

onMounted(() => {
  void loadApprovals()
})
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden antialiased sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Content</p>
        <h1 class="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Template approvals
        </h1>
        <p class="mt-1.5 max-w-2xl text-sm text-slate-500">
          Review LO / LOA email templates before they can be used to send.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink
          to="/tenant/email-templates"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          All templates
        </NuxtLink>
        <TenantRefreshIconButton
          label="Refresh approvals"
          :pending="pending"
          @click="() => loadApprovals()"
        />
      </div>
    </header>

    <div
      v-if="tenantFlagsLoaded && !canAccess"
      class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950"
      role="status"
    >
      Template approvals are only available when LO recipient lists are enabled and you sign in as
      Operations Manager or Marketing.
    </div>

    <template v-else>
      <div
        v-if="canAccess && !loadError"
        class="min-w-0"
      >
        <label class="sr-only" for="template-approvals-search">Search pending templates</label>
        <div class="relative">
          <svg
            class="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            id="template-approvals-search"
            v-model="searchQuery"
            type="search"
            autocomplete="off"
            placeholder="Search by name or subject…"
            class="w-full rounded-xl border border-slate-200/90 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 sm:py-3.5 sm:text-[0.9375rem]"
          >
        </div>
      </div>

      <div
        v-if="loadError"
        class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900"
        role="alert"
      >
        {{ loadError }}
      </div>

      <div
        v-else-if="pending"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3"
      >
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
        class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center shadow-sm"
      >
        <h3 class="text-lg font-semibold text-slate-900">No pending approvals</h3>
        <p class="mt-2 max-w-sm text-sm text-slate-500">
          When loan officers submit templates, they will appear here.
        </p>
      </div>

      <div
        v-else-if="!filteredTemplates.length"
        class="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center shadow-sm"
      >
        <h3 class="text-lg font-semibold text-slate-900">No matching templates</h3>
        <p class="mt-2 text-sm text-slate-500">
          Try a different search.
        </p>
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3"
      >
        <article
          v-for="row in filteredTemplates"
          :key="row.id"
          class="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
        >
          <button
            type="button"
            class="group relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50 text-left transition-colors hover:bg-slate-100/80 active:bg-slate-100"
            :aria-label="`Enlarge preview of ${row.name}`"
            @click="openPreview(row)"
          >
            <TenantEmailTemplateThumbnail
              v-if="row.htmlTemplate?.trim()"
              :html="row.htmlTemplate"
              :title="`${row.name} thumbnail`"
              class="absolute inset-0"
            />
            <div
              v-else
              class="flex h-full items-center justify-center text-sm text-slate-400"
            >
              No preview
            </div>
            <span
              class="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/10"
            >
              <span
                class="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm sm:static sm:px-3 sm:py-1.5 sm:text-xs sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
              >
                <Maximize2 class="h-3.5 w-3.5" aria-hidden="true" />
                Enlarge
              </span>
            </span>
          </button>

          <div class="flex flex-1 flex-col p-4 sm:p-5">
            <div class="flex items-start justify-between gap-2">
              <h2 class="min-w-0 truncate text-base font-semibold text-slate-900">
                {{ row.name }}
              </h2>
              <TenantEmailTemplateApprovalBadge
                :status="row.approvalStatus"
                class="shrink-0"
              />
            </div>
            <p class="mt-1 truncate text-sm text-slate-500">
              {{ row.subject?.trim() || row.description?.trim() || 'No subject' }}
            </p>
            <p class="mt-2 text-xs text-slate-400">
              From {{ creatorLabel(row) }} · Submitted {{ formatSubmitted(row.approvalSubmittedAt) }}
            </p>

            <div class="mt-4 flex flex-col gap-2">
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800"
                  @click="openPreview(row)"
                >
                  <Maximize2 class="h-4 w-4 shrink-0" aria-hidden="true" />
                  Preview
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  :disabled="actionId === row.id"
                  @click="approve(row)"
                >
                  <Check class="h-4 w-4 shrink-0" aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-2 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                  :disabled="actionId === row.id"
                  @click="openReject(row)"
                >
                  <X class="h-4 w-4 shrink-0" aria-hidden="true" />
                  Reject
                </button>
              </div>
              <NuxtLink
                :to="makeCampaignHref(row.id)"
                class="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                <Megaphone class="h-4 w-4 shrink-0" aria-hidden="true" />
                Make campaign
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>
    </template>

    <TenantEmailTemplatePreviewModal
      v-if="previewOpen && previewTemplate"
      :open="previewOpen"
      :name="previewTemplate.name"
      :subject="previewTemplate.subject"
      :html="previewTemplate.htmlTemplate || ''"
      :template-id="previewTemplate.id"
      @close="closePreview"
    />

    <div
      v-if="rejectOpen"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-template-title"
      @click.self="closeReject"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="reject-template-title" class="text-lg font-semibold text-slate-900">
          Reject template
        </h3>
        <p class="mt-1 text-sm text-slate-500">
          {{ rejectTarget?.name }}
        </p>
        <label class="mt-4 block text-sm font-medium text-slate-700" for="reject-reason">
          Reason (optional)
        </label>
        <textarea
          id="reject-reason"
          v-model="rejectReason"
          rows="3"
          class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Tell the creator what to change…"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="closeReject"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            :disabled="Boolean(actionId)"
            @click="confirmReject"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
