<template>
  <div class="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 sm:px-5">
    <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      This list includes
    </p>
    <p
      v-if="preview.empty"
      class="mt-1.5 text-sm leading-relaxed text-slate-600"
    >
      Everyone in <span class="font-semibold text-slate-900">{{ preview.audienceLabel }}</span>. Add a condition to narrow it.
    </p>
    <p
      v-else
      class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm leading-relaxed text-slate-800"
      aria-live="polite"
    >
      <span class="text-slate-500">
        <span class="font-semibold text-slate-900">{{ preview.audienceLabel }}</span>
        where
      </span>
      <template v-for="(part, i) in preview.parts" :key="i">
        <span
          v-if="part.kind === 'paren'"
          class="px-0.5 text-lg font-medium leading-none text-slate-400"
        >{{ part.side }}</span>
        <span
          v-else-if="part.kind === 'join'"
          class="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          :class="!part.join
            ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-800'
            : part.level === 'group'
              ? (part.join === 'or' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white')
              : (part.join === 'or' ? 'bg-amber-100 text-amber-900' : 'bg-white text-slate-700 ring-1 ring-slate-200')"
        >{{ part.join || 'choose' }}</span>
        <span
          v-else-if="part.kind === 'placeholder'"
          class="rounded-md border border-dashed border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800"
        >{{ part.text }}</span>
        <span
          v-else
          class="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg bg-white px-1.5 py-1 ring-1 ring-slate-200/90"
        >
          <span class="rounded-md bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-950">{{ part.field }}</span>
          <template v-if="part.value || part.incomplete">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">equals</span>
            <span
              class="rounded-md px-1.5 py-0.5"
              :class="part.incomplete ? 'border border-dashed border-emerald-300 bg-emerald-50 italic text-emerald-700' : 'bg-emerald-100 font-semibold text-emerald-950'"
            >{{ part.incomplete ? 'a value' : part.value }}</span>
          </template>
        </span>
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { RecipientListPreviewPart } from '~/composables/useRecipientListForm'

defineProps<{
  preview: {
    audienceLabel: string
    empty: boolean
    parts: RecipientListPreviewPart[]
  }
}>()
</script>
