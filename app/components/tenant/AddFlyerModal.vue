<script setup lang="ts">
import {
  FLYER_FILE_INPUT_ACCEPT,
  FLYER_UPLOAD_HELP_TEXT
} from '~~/shared/constants/flyerUpload'
import { normalizeFlyerName } from '~~/shared/utils/normalizeFlyerName'

const props = defineProps<{
  open: boolean
  flyerName: string
  selectedCategoryId: string
  categoryAssignOptions: ReadonlyArray<{ value: string; label: string }>
  categoriesManagePath: string
  hasCategories: boolean
  pendingFileName: string
  pendingFileSizeLabel: string
  pendingContentType: string
  pendingPreviewUrl: string
  canSubmit: boolean
}>()

const emit = defineEmits<{
  close: []
  'update:flyerName': [value: string]
  'update:selectedCategoryId': [value: string]
  fileChange: [event: Event]
  clearFile: []
  submit: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const hasPendingFile = computed(() => Boolean(props.pendingFileName.trim()))
const needsNameHint = computed(
  () => hasPendingFile.value && !normalizeFlyerName(props.flyerName)
)

function pickFile() {
  fileInputRef.value?.click()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-flyer-modal-title"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[min(92vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div class="min-w-0 flex-1">
            <h3 id="add-flyer-modal-title" class="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Add flyer
            </h3>
            <p class="mt-1 text-sm text-slate-500">
              Pick a printable PDF or image anytime — add a name before you submit.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <div class="grid min-w-0 gap-4 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="block text-sm font-medium text-slate-700" for="add-flyer-name">
                Flyer name
              </label>
              <input
                id="add-flyer-name"
                :value="flyerName"
                type="text"
                maxlength="120"
                placeholder="e.g. Spring promo"
                class="mt-1.5 w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20"
                @input="emit('update:flyerName', ($event.target as HTMLInputElement).value)"
              >
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="block text-sm font-medium text-slate-700" for="add-flyer-category">
                  Template category
                </label>
                <NuxtLink
                  :to="categoriesManagePath"
                  class="text-xs font-semibold text-primary-600 hover:text-primary-700"
                  @click="emit('close')"
                >
                  Manage categories
                </NuxtLink>
              </div>
              <TenantFilterSelect
                id="add-flyer-category"
                :model-value="selectedCategoryId"
                label="Template category"
                variant="field"
                :options="categoryAssignOptions"
                class="mt-1.5"
                @update:model-value="emit('update:selectedCategoryId', $event)"
              />
              <p v-if="!hasCategories" class="mt-1.5 text-xs text-slate-500">
                None yet — create one if you want to group this flyer.
              </p>
            </div>
          </div>

          <div>
            <p class="mb-2 text-sm font-medium text-slate-700">Flyer file</p>
            <button
              v-if="!hasPendingFile"
              type="button"
              class="flex min-h-[14rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center transition hover:border-primary-300 hover:bg-primary-50/40 sm:min-h-[18rem]"
              @click="pickFile"
            >
              <span
                class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm ring-1 ring-slate-200"
                aria-hidden="true"
              >
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.75"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              </span>
              <span class="text-sm font-semibold text-slate-900">
                Click to choose PDF or image
              </span>
              <span class="max-w-sm text-sm text-slate-500">
                {{ FLYER_UPLOAD_HELP_TEXT }}
              </span>
            </button>

            <TenantFlyerPendingFileCard
              v-else
              :file-name="pendingFileName"
              :file-size-label="pendingFileSizeLabel"
              :content-type="pendingContentType"
              :preview-url="pendingPreviewUrl"
              :needs-name-hint="needsNameHint"
              @change="pickFile"
              @clear="emit('clearFile')"
            />

            <input
              ref="fileInputRef"
              type="file"
              :accept="FLYER_FILE_INPUT_ACCEPT"
              class="sr-only"
              tabindex="-1"
              @change="emit('fileChange', $event)"
            >
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canSubmit"
            @click="emit('submit')"
          >
            Upload flyer
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
