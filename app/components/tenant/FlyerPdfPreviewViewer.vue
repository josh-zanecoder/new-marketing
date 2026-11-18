<script setup lang="ts">
const props = defineProps<{
  flyerId: string
  active: boolean
  alt: string
}>()

const flyerIdRef = toRef(props, 'flyerId')
const activeRef = toRef(props, 'active')
const { pages, pending, failed, progressLabel } = useFlyerPdfPreviewPages(
  flyerIdRef,
  activeRef
)
</script>

<template>
  <div class="flex h-[min(70vh,40rem)] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
    <div
      v-if="pending"
      class="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <svg class="h-7 w-7 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="text-sm text-slate-600">{{ progressLabel || 'Preparing preview…' }}</p>
    </div>

    <div
      v-else-if="failed"
      class="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500"
    >
      Preview unavailable for this PDF.
    </div>

    <div
      v-else
      class="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6"
    >
      <img
        v-for="(pageUrl, index) in pages"
        :key="`${flyerId}-${index}`"
        :src="pageUrl"
        :alt="`${alt} — page ${index + 1}`"
        class="mx-auto block w-full max-w-3xl rounded-md bg-white shadow-sm ring-1 ring-slate-200/80"
      >
    </div>
  </div>
</template>
