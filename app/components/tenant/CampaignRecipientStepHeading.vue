<script setup lang="ts">
/** Numbered heading for the step-by-step recipients flow (Advanced Recipient Filtering only). */
defineProps<{
  step: number
  title: string
  hint?: string
  /** Shows a check instead of the number. */
  done?: boolean
}>()
</script>

<template>
  <div class="flex items-start gap-3">
    <span
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors"
      :class="done ? 'bg-emerald-500 text-white' : 'bg-primary-600 text-white'"
      aria-hidden="true"
    >
      <svg
        v-if="done"
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
          d="M5 13l4 4L19 7"
        />
      </svg>
      <template v-else>{{ step }}</template>
    </span>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold text-slate-900 sm:text-[15px]">
        <span class="sr-only">Step {{ step }}: </span>{{ title }}
      </h3>
      <p
        v-if="hint"
        class="mt-0.5 text-sm text-slate-500"
      >
        {{ hint }}
      </p>
    </div>
  </div>
</template>
