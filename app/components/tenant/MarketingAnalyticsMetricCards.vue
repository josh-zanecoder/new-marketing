<script setup lang="ts">
import type { MarketingAnalyticsMetricCard } from '~/types/marketingAnalytics'

defineProps<{
  cards: MarketingAnalyticsMetricCard[]
  loading?: boolean
}>()
</script>

<template>
  <section aria-label="Key metrics">
    <div class="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-zinc-900">
          Key metrics
        </h2>
        <p class="mt-0.5 text-xs text-zinc-500">
          Totals and rates for the selected filters
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="n in 6"
        :key="n"
        class="animate-pulse rounded-2xl border border-zinc-200/90 bg-white p-5"
      >
        <div class="h-10 w-10 rounded-xl bg-zinc-100" />
        <div class="mt-4 h-4 w-24 rounded bg-zinc-100" />
        <div class="mt-3 h-8 w-20 rounded bg-zinc-100" />
      </div>
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <article
        v-for="card in cards"
        :key="card.id"
        class="rounded-2xl border p-5 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-900/[0.02]"
        :class="card.cardClass"
      >
        <div class="flex items-start justify-between gap-3">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            :class="card.iconBgClass"
          >
            <svg
              v-if="card.id === 'sent'"
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg
              v-else-if="card.id === 'delivered'"
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg
              v-else-if="card.id === 'open-rate'"
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg
              v-else-if="card.id === 'click-rate'"
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M3.743 14.006l-2.898.777M7.188 21.761l-.777-2.898M12 5.866V3m0 18v-2.866" />
            </svg>
            <svg
              v-else-if="card.id === 'bounce-rate'"
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <svg
              v-else
              class="h-5 w-5"
              :class="card.iconClass"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        <p class="mt-4 text-sm font-medium text-zinc-500">
          {{ card.label }}
        </p>
        <p class="mt-2 text-3xl font-semibold tabular-nums tracking-tight" :class="card.accentClass">
          {{ card.value }}
        </p>
        <p v-if="card.hint" class="mt-2 text-xs text-zinc-500">
          {{ card.hint }}
        </p>
      </article>
    </div>
  </section>
</template>
