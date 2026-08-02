<script setup lang="ts">
import type { MarketingAnalyticsEventItem } from '~/types/marketingAnalytics'
import {
  brevoSmtpEventBadgeClass,
  formatBrevoSmtpEventLabel,
  formatBrevoSmtpEventTableDate
} from '~/utils/brevoSmtpEventFormat'

const props = withDefaults(
  defineProps<{
    items: MarketingAnalyticsEventItem[]
    loading?: boolean
    page: number
    hasMore: boolean
    rangeTitle?: string
  }>(),
  {
    loading: false,
    rangeTitle: ''
  }
)

const emit = defineEmits<{
  'update:page': [page: number]
}>()

function goPage(page: number) {
  if (page < 1 || page === props.page) return
  if (page > props.page && !props.hasMore) return
  emit('update:page', page)
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.04]"
    :aria-busy="loading"
  >
    <div class="border-b border-zinc-100 px-4 py-3 sm:px-5">
      <p class="text-sm font-semibold text-zinc-800">Messages</p>
      <p class="mt-0.5 text-xs text-zinc-500">
        {{ rangeTitle || 'Latest events (10 per page)' }}
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="border-b border-zinc-100 bg-zinc-50/60 text-xs uppercase tracking-wide text-zinc-500">
            <th class="px-4 py-3 font-semibold sm:px-5">Event</th>
            <th class="px-4 py-3 font-semibold sm:px-5">Date</th>
            <th class="px-4 py-3 font-semibold sm:px-5">Subject</th>
            <th class="px-4 py-3 font-semibold sm:px-5">From</th>
            <th class="px-4 py-3 font-semibold sm:px-5">To</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(ev, idx) in items"
            :key="(ev.messageId || 'm') + (ev.date || '') + idx"
            class="border-t border-zinc-100 hover:bg-zinc-50/80"
          >
            <td class="whitespace-nowrap px-4 py-3 sm:px-5">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="brevoSmtpEventBadgeClass(ev.event)"
              >
                {{ formatBrevoSmtpEventLabel(ev.event) }}
              </span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700 sm:px-5">
              {{ formatBrevoSmtpEventTableDate(ev.date) }}
            </td>
            <td class="max-w-[14rem] truncate px-4 py-3 text-zinc-800 sm:px-5">
              {{ ev.subject || '—' }}
            </td>
            <td class="max-w-[12rem] truncate px-4 py-3 text-zinc-600 sm:px-5">
              {{ ev.from || '—' }}
            </td>
            <td class="max-w-[12rem] truncate px-4 py-3 text-zinc-600 sm:px-5">
              {{ ev.email || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="loading && !items.length"
      class="px-5 py-10 text-center text-sm text-zinc-500"
    >
      Loading events…
    </div>
    <div
      v-else-if="!items.length"
      class="px-5 py-12 text-center text-sm text-zinc-500"
    >
      No events in this range.
    </div>
    <div
      v-else
      class="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-600 sm:px-5"
    >
      <p>Page {{ page }}</p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
          :disabled="page <= 1 || loading"
          @click="goPage(page - 1)"
        >
          Prev
        </button>
        <button
          type="button"
          class="h-8 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 disabled:opacity-40"
          :disabled="!hasMore || loading"
          @click="goPage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
