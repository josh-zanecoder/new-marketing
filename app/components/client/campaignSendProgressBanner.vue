<script setup lang="ts">
import type { CampaignSendProgress } from '~/utils/campaignSendRules'

const props = defineProps<{
  progress: CampaignSendProgress
  /** e.g. "Scheduled send" vs "Sending" */
  label?: string
  /** When true, clicking opens the detailed send report modal. */
  clickable?: boolean
}>()

const emit = defineEmits<{
  open: []
}>()

const heading = computed(() => props.label?.trim() || 'Sending in progress')

function onActivate() {
  if (props.clickable) emit('open')
}
</script>

<template>
  <component
    :is="props.clickable ? 'button' : 'div'"
    :type="props.clickable ? 'button' : undefined"
    class="mt-3 w-full rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3.5 text-left text-sm text-indigo-950 shadow-sm ring-1 ring-indigo-100/80 sm:py-4"
    :class="props.clickable ? 'cursor-pointer transition-colors hover:border-indigo-300 hover:bg-indigo-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' : ''"
    role="status"
    aria-live="polite"
    :aria-busy="!props.progress.done"
    @click="onActivate"
  >
    <div class="flex flex-wrap items-center gap-2">
      <svg
        v-if="!props.progress.done"
        class="h-4 w-4 shrink-0 animate-spin text-indigo-600"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="font-semibold">{{ heading }}</span>
      <span class="tabular-nums text-indigo-800">
        {{ props.progress.processed }} of {{ props.progress.total }}
        <span v-if="!props.progress.done">— {{ Math.round(props.progress.pct) }}%</span>
      </span>
      <span
        v-if="props.clickable"
        class="ml-auto shrink-0 text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
      >
        View details
      </span>
    </div>
    <div class="mt-3 h-2 overflow-hidden rounded-full bg-indigo-200/80">
      <div
        class="h-full rounded-full bg-indigo-700 transition-all duration-700 ease-out"
        :style="{ width: `${props.progress.pct}%` }"
      />
    </div>
    <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold tabular-nums sm:text-sm">
      <span class="text-emerald-800">Sent {{ props.progress.sent }}</span>
      <span class="text-red-800">Failed {{ props.progress.failed }}</span>
      <span class="text-indigo-800">Pending {{ props.progress.remaining }}</span>
    </div>
  </component>
</template>
