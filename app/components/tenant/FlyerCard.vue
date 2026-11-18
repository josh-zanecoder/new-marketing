<script setup lang="ts">
import { Eye, Printer, Trash2 } from 'lucide-vue-next'
import { isFlyerImageMime, isFlyerPdfMime } from '~~/shared/utils/flyerUpload'
import type { FlyerGroupItem } from '~~/shared/utils/groupFlyersByCategory'

const props = defineProps<{
  flyer: FlyerGroupItem
  canDelete: boolean
}>()

const emit = defineEmits<{
  print: []
  view: []
  delete: []
  'filter-category': [categoryId: string]
}>()

const categoryLabel = computed(() => props.flyer.categoryName?.trim() || 'Uncategorized')
const canFilterCategory = computed(() => Boolean(props.flyer.categoryId?.trim()))
const isImage = computed(() => isFlyerImageMime(props.flyer.contentType || ''))
const isPdf = computed(() => isFlyerPdfMime(props.flyer.contentType || ''))
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
    <div class="relative aspect-[4/3] bg-zinc-100">
      <img
        v-if="isImage"
        :src="flyer.imageUrl"
        :alt="flyer.name"
        class="h-full w-full object-cover"
        loading="lazy"
      >
      <ClientOnly v-else-if="isPdf">
        <TenantFlyerPdfThumbnail
          :flyer-id="flyer.id"
          :alt="flyer.name"
        />
        <template #fallback>
          <div class="flex h-full w-full items-center justify-center bg-zinc-100">
            <span
              class="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 ring-1 ring-zinc-200"
            >
              PDF
            </span>
          </div>
        </template>
      </ClientOnly>
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-100 px-4 text-center"
      >
        <span
          class="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 ring-1 ring-zinc-200"
        >
          File
        </span>
      </div>

      <div class="absolute left-2.5 top-2.5 z-10 max-w-[calc(100%-1.25rem)]">
        <button
          v-if="canFilterCategory"
          type="button"
          class="inline-flex max-w-full items-center truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-sm ring-1 ring-primary-200/80 backdrop-blur-sm transition hover:bg-primary-50"
          :title="`Show only ${categoryLabel}`"
          @click="emit('filter-category', flyer.categoryId!)"
        >
          {{ categoryLabel }}
        </button>
        <span
          v-else
          class="inline-flex max-w-full items-center truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 shadow-sm ring-1 ring-zinc-200/90 backdrop-blur-sm"
        >
          {{ categoryLabel }}
        </span>
      </div>
    </div>

    <div class="space-y-3 p-3.5">
      <p class="truncate text-sm font-semibold text-zinc-900" :title="flyer.name">
        {{ flyer.name }}
      </p>

      <div
        class="grid gap-2"
        :class="canDelete ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          @click="emit('print')"
        >
          <Printer class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Print
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          @click="emit('view')"
        >
          <Eye class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          View
        </button>
        <button
          v-if="canDelete"
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100"
          :aria-label="`Delete ${flyer.name}`"
          title="Delete flyer"
          @click="emit('delete')"
        >
          <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </article>
</template>
