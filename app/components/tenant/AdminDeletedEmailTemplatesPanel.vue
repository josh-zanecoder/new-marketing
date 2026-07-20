<script setup lang="ts">
import { Maximize2, RotateCcw, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  tenantId: string | null
}>()

const tenantIdRef = toRef(props, 'tenantId')

const {
  pending,
  loadError,
  templates,
  templateToHardDelete,
  templateToRecover,
  hardDeleteLoading,
  recoverLoading,
  busyId,
  previewOpen,
  previewTemplate,
  hardDeleteModalMessage,
  recoverModalMessage,
  formatDeletedAt,
  openPreview,
  closePreview,
  loadDeletedTemplates,
  openHardDeleteModal,
  cancelHardDeleteModal,
  confirmHardDelete,
  openRecoverModal,
  cancelRecoverModal,
  confirmRecover
} = useAdminDeletedEmailTemplates(tenantIdRef)
</script>

<template>
  <div class="min-w-0 space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <h2 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Deleted templates
        </h2>
        <p class="max-w-2xl text-sm text-slate-500 sm:text-[0.9375rem] sm:leading-relaxed">
          Soft-deleted library templates for this tenant. Recover restores them to the library; delete forever removes them permanently.
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-3 self-start">
        <TenantRefreshIconButton
          aria-label="Refresh deleted templates"
          :pending="pending"
          @click="loadDeletedTemplates"
        />
      </div>
    </header>

    <div
      v-if="!tenantId"
      class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      This tenant has no <strong>tenant ID</strong> in the registry. Set one before managing deleted templates.
    </div>

    <div
      v-else-if="loadError"
      class="flex gap-3.5 rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm leading-snug text-red-900 shadow-sm"
      role="alert"
    >
      {{ loadError }}
    </div>

    <div v-else-if="pending && !templates.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
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
        No deleted templates
      </h3>
      <p class="mt-2 max-w-sm text-sm text-slate-500">
        Soft-deleted templates from the tenant library will show up here.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
      <article
        v-for="template in templates"
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
          <p
            v-if="template.categoryName?.trim()"
            class="mt-2 inline-flex w-fit max-w-full truncate rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
            :title="template.categoryName"
          >
            {{ template.categoryName }}
          </p>
          <p class="mt-2 text-xs text-slate-400">
            Deleted {{ formatDeletedAt(template.deletedAt) }}
          </p>
          <div class="mt-4 flex flex-col gap-2">
            <button
              type="button"
              class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800"
              @click="openPreview(template)"
            >
              <Maximize2 class="h-4 w-4 shrink-0" aria-hidden="true" />
              Preview
            </button>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 disabled:opacity-50"
                :disabled="busyId === template.id"
                @click="openRecoverModal(template)"
              >
                <RotateCcw class="h-4 w-4 shrink-0" aria-hidden="true" />
                Recover
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-2 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                :disabled="busyId === template.id"
                :aria-label="`Delete ${template.name} forever`"
                @click="openHardDeleteModal(template)"
              >
                <Trash2 class="h-4 w-4 shrink-0" aria-hidden="true" />
                Delete forever
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>

    <TenantEmailTemplatePreviewModal
      :open="previewOpen"
      :name="previewTemplate?.name ?? ''"
      :subject="previewTemplate?.subject"
      :html="previewTemplate?.htmlTemplate ?? ''"
      :template-id="previewTemplate?.id"
      @close="closePreview"
    />

    <ClientConfirmationModal
      :open="!!templateToRecover"
      title="Recover template"
      :message="recoverModalMessage"
      confirm-text="Recover"
      variant="primary"
      :confirm-loading="recoverLoading"
      @confirm="confirmRecover"
      @cancel="cancelRecoverModal"
    >
      <template #confirm-icon>
        <RotateCcw class="h-4 w-4" aria-hidden="true" />
      </template>
    </ClientConfirmationModal>

    <ClientConfirmationModal
      :open="!!templateToHardDelete"
      title="Delete forever"
      :message="hardDeleteModalMessage"
      confirm-text="Delete forever"
      variant="danger"
      :confirm-loading="hardDeleteLoading"
      @confirm="confirmHardDelete"
      @cancel="cancelHardDeleteModal"
    >
      <template #confirm-icon>
        <Trash2 class="h-4 w-4" aria-hidden="true" />
      </template>
    </ClientConfirmationModal>
  </div>
</template>
