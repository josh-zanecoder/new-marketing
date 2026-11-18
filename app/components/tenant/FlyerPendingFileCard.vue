<script setup lang="ts">
import { FileText, ImageIcon, RefreshCw, Trash2 } from 'lucide-vue-next'
import { FLYER_UPLOAD_NAME_REQUIRED_HINT } from '~~/shared/constants/flyerUpload'
import { isFlyerImageMime, isFlyerPdfMime } from '~~/shared/utils/flyerUpload'

const props = defineProps<{
  fileName: string
  fileSizeLabel: string
  contentType: string
  previewUrl: string
  needsNameHint: boolean
}>()

defineEmits<{
  change: []
  clear: []
}>()

const isImage = computed(() => isFlyerImageMime(props.contentType))
const isPdf = computed(() => isFlyerPdfMime(props.contentType))
const typeLabel = computed(() => {
  if (isPdf.value) return 'PDF'
  if (isImage.value) {
    const subtype = props.contentType.split('/')[1]?.toUpperCase()
    return subtype || 'Image'
  }
  return 'File'
})
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-primary-200/80 bg-gradient-to-br from-primary-50/70 via-white to-white shadow-sm shadow-primary-600/5"
  >
    <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
      <div
        class="relative mx-auto flex h-36 w-full max-w-[11rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200/80 sm:mx-0 sm:h-40 sm:w-36"
      >
        <img
          v-if="isImage && previewUrl"
          :src="previewUrl"
          :alt="fileName"
          class="h-full w-full object-cover"
        >
        <div
          v-else
          class="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center"
        >
          <span
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm ring-1 ring-primary-100"
            aria-hidden="true"
          >
            <FileText v-if="isPdf" class="h-6 w-6" />
            <ImageIcon v-else class="h-6 w-6" />
          </span>
          <span
            class="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-700 ring-1 ring-zinc-200"
          >
            {{ typeLabel }}
          </span>
        </div>
        <span
          class="absolute left-2 top-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
        >
          Ready
        </span>
      </div>

      <div class="min-w-0 flex-1 space-y-3 text-left">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-primary-600">
            Selected file
          </p>
          <p class="mt-1 truncate text-sm font-semibold text-zinc-900" :title="fileName">
            {{ fileName }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              class="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700"
            >
              {{ typeLabel }}
            </span>
            <span
              v-if="fileSizeLabel"
              class="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700"
            >
              {{ fileSizeLabel }}
            </span>
            <span
              class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
            >
              Ready to upload
            </span>
          </div>
        </div>

        <p v-if="needsNameHint" class="text-sm text-zinc-500">
          {{ FLYER_UPLOAD_NAME_REQUIRED_HINT }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            @click="$emit('change')"
          >
            <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
            Change file
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
            @click="$emit('clear')"
          >
            <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
