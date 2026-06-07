<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  description: string
  campaignName?: string
  scheduleLocal: string
  scheduleError: string
  scheduleBusy: boolean
  titleId?: string
  inputId?: string
}>()

const emit = defineEmits<{
  'update:scheduleLocal': [value: string]
  close: []
  confirm: []
}>()

function onInput(event: Event) {
  emit('update:scheduleLocal', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId ?? 'schedule-campaign-title'"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      />
      <div
        class="relative w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:rounded-2xl sm:p-6"
      >
        <h2 :id="titleId ?? 'schedule-campaign-title'" class="text-lg font-semibold text-slate-900">
          {{ title }}
        </h2>
        <p
          v-if="campaignName"
          class="mt-1 truncate text-sm text-slate-600"
          :title="campaignName"
        >
          {{ campaignName || 'Untitled' }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          {{ description }}
        </p>
        <label class="mt-4 block text-sm font-medium text-slate-700" :for="inputId ?? 'schedule-campaign-datetime'">
          Date &amp; time
        </label>
        <input
          :id="inputId ?? 'schedule-campaign-datetime'"
          :value="scheduleLocal"
          type="datetime-local"
          class="mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20"
          @input="onInput"
        >
        <p v-if="scheduleError" class="mt-3 text-sm text-red-600" role="alert">
          {{ scheduleError }}
        </p>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            :disabled="scheduleBusy"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:opacity-50"
            :disabled="scheduleBusy"
            @click="emit('confirm')"
          >
            {{ scheduleBusy ? 'Saving…' : 'Schedule' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
