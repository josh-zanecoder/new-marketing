<script setup lang="ts">
import { FileText } from 'lucide-vue-next'

const props = defineProps<{
  flyerId: string
  alt: string
  /** Optional override (admin trash uses admin file API). */
  fileUrl?: string
}>()

const { thumbnailUrl, pending, failed } = useFlyerPdfThumbnail(
  toRef(props, 'flyerId'),
  toRef(props, 'fileUrl')
)
</script>

<template>
  <div class="relative h-full w-full bg-zinc-100">
    <img
      v-if="thumbnailUrl"
      :src="thumbnailUrl"
      :alt="alt"
      class="h-full w-full object-cover object-top"
      loading="lazy"
    >
    <div
      v-else
      class="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-50 to-zinc-100/80 px-4 text-center"
      :aria-busy="pending"
    >
      <span
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-zinc-200"
        aria-hidden="true"
      >
        <svg
          v-if="pending"
          class="h-6 w-6 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <FileText v-else class="h-6 w-6" />
      </span>
      <span
        class="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 ring-1 ring-zinc-200"
      >
        PDF
      </span>
      <p class="text-xs text-zinc-500">
        {{ pending ? 'Loading preview…' : failed ? 'Preview unavailable' : 'PDF document' }}
      </p>
    </div>
    <span
      v-if="thumbnailUrl"
      class="absolute bottom-2 right-2 rounded-md bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
    >
      PDF
    </span>
  </div>
</template>
