<script setup lang="ts">
import { Printer, X } from 'lucide-vue-next'
import { isFlyerImageMime, isFlyerPdfMime } from '~~/shared/utils/flyerUpload'
import type { FlyerGroupItem } from '~~/shared/utils/groupFlyersByCategory'

const props = defineProps<{
  open: boolean
  flyer: FlyerGroupItem | null
}>()

const emit = defineEmits<{
  close: []
  print: []
}>()

const isImage = computed(() => isFlyerImageMime(props.flyer?.contentType || ''))
const isPdf = computed(() => isFlyerPdfMime(props.flyer?.contentType || ''))
const categoryLabel = computed(
  () => props.flyer?.categoryName?.trim() || 'Uncategorized'
)
const pdfPreviewActive = computed(() => props.open && Boolean(props.flyer?.id) && isPdf.value)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (!import.meta.client) return
    if (isOpen) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  }
)

onUnmounted(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && flyer"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flyer-preview-title"
      @click.self="emit('close')"
    >
      <div
        class="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/60"
      >
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <h3
              id="flyer-preview-title"
              class="truncate text-base font-semibold text-slate-900"
              :title="flyer.name"
            >
              {{ flyer.name }}
            </h3>
            <p class="mt-0.5 truncate text-xs text-slate-500">
              {{ categoryLabel }}
              <span v-if="isPdf"> · PDF</span>
              <span v-else-if="isImage"> · Image</span>
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close preview"
            @click="emit('close')"
          >
            <X class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div class="flex min-h-0 flex-1 items-center justify-center bg-slate-50 px-3 py-4 sm:px-5 sm:py-6">
          <img
            v-if="isImage"
            :src="flyer.imageUrl"
            :alt="flyer.name"
            class="max-h-[min(70vh,40rem)] max-w-full rounded-lg object-contain shadow-sm"
          >
          <ClientOnly v-else-if="isPdf && flyer.id">
            <TenantFlyerPdfPreviewViewer
              :flyer-id="flyer.id"
              :active="pdfPreviewActive"
              :alt="flyer.name"
            />
            <template #fallback>
              <div class="flex h-[min(70vh,40rem)] w-full items-center justify-center text-sm text-slate-500">
                Loading preview…
              </div>
            </template>
          </ClientOnly>
          <p v-else class="text-sm text-slate-500">
            Preview unavailable for this file.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            @click="emit('close')"
          >
            Close
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            @click="emit('print')"
          >
            <Printer class="h-4 w-4 shrink-0" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
