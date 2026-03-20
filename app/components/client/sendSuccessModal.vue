<script setup lang="ts">
const props = defineProps<{
  open: boolean
  campaignName: string
  sent: number
  failed: number
  campaignStatus: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        @click.self="emit('close')"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60 transition-all duration-300 ease-out scale-100"
        >
          <div class="flex flex-col items-center text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-transform duration-300 ease-out"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 class="mt-4 text-lg font-semibold text-slate-900">
              Campaign sent
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              {{ props.campaignName || 'Your campaign' }} finished as <span class="font-medium text-slate-800">{{ props.campaignStatus }}</span>.
            </p>
            <div class="mt-5 grid w-full grid-cols-2 gap-3">
              <div class="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                <div class="text-2xl font-bold tabular-nums text-emerald-800">{{ props.sent }}</div>
                <div class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Sent</div>
              </div>
              <div class="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3">
                <div class="text-2xl font-bold tabular-nums text-red-800">{{ props.failed }}</div>
                <div class="text-xs font-semibold uppercase tracking-wide text-red-700">Failed</div>
              </div>
            </div>
            <button
              type="button"
              class="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
