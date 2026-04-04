<script setup lang="ts">
const props = defineProps<{
  open: boolean
  campaignName: string
  sendError: string | null
  sendProgress: {
    total: number
    sent: number
    failed: number
    remaining: number
    processed: number
    pct: number
    done: boolean
    campaignStatus: string
  } | null
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-2">
            <svg
              v-if="props.sendProgress && !props.sendProgress.done"
              class="h-5 w-5 animate-spin text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 class="text-lg font-semibold text-slate-900">
              <template v-if="props.sendProgress?.done">Send finished</template>
              <template v-else>Sending {{ props.campaignName || 'campaign' }}</template>
            </h3>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            @click="emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div v-if="props.sendError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ props.sendError }}
        </div>
        <div v-else-if="props.sendProgress" class="space-y-5 transition-all duration-500 ease-out">
          <p class="text-base font-medium text-slate-900">
            <template v-if="props.sendProgress.done">
              {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} processed
            </template>
            <template v-else>
              {{ props.sendProgress.processed }} of {{ props.sendProgress.total }} — sending
            </template>
          </p>
          <div class="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full bg-slate-900 transition-all duration-700 ease-out"
              :style="{ width: `${props.sendProgress.pct}%` }"
            />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
              <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.sent }}</div>
              <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Sent</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
              <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.failed }}</div>
              <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">Failed</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
              <div class="text-lg font-bold tabular-nums text-slate-900">{{ props.sendProgress.remaining }}</div>
              <div class="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">Pending</div>
            </div>
          </div>
        </div>
        <div v-else class="flex items-center gap-3 text-sm text-slate-500">
          <svg class="h-5 w-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Starting...
        </div>
      </div>
    </div>
  </Teleport>
</template>
