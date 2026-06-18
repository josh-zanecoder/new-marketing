<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { formatYmdDisplay, toYmdLocal } from '~/composables/useBrevoTrackingDateRange'

const visible = defineModel<boolean>('visible', { required: true })
const range = defineModel<[Date, Date] | null>('range', { required: true })

const maxSelectableDate = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
})

const selectedLabel = computed(() => {
  if (!range.value?.[0] || !range.value?.[1]) return 'No range selected'
  return `${formatYmdDisplay(toYmdLocal(range.value[0]))} – ${formatYmdDisplay(toYmdLocal(range.value[1]))}`
})

const canApply = computed(() => {
  if (!range.value?.[0] || !range.value?.[1]) return false
  return range.value[0].getTime() <= range.value[1].getTime()
})

const emit = defineEmits<{
  close: []
  apply: []
}>()

const isMobile = ref(false)
let escListener: ((e: KeyboardEvent) => void) | null = null
let mediaQuery: MediaQueryList | null = null

function syncMobile() {
  if (!import.meta.client) return
  isMobile.value = window.matchMedia('(max-width: 639px)').matches
}

function isValidRange(dates: [Date, Date] | null): dates is [Date, Date] {
  if (!dates?.[0] || !dates?.[1]) return false
  return dates[0].getTime() <= dates[1].getTime()
}

function dismiss() {
  emit('close')
}

function applyRange() {
  if (!isValidRange(range.value)) return
  emit('apply')
}

function closeModal() {
  if (isValidRange(range.value)) {
    emit('apply')
    return
  }
  emit('close')
}

function onRangeEnd(dates: [Date, Date] | null) {
  if (!isValidRange(dates)) return
  emit('apply')
}

watch(visible, (open) => {
  if (!import.meta.client) return

  document.body.style.overflow = open ? 'hidden' : ''

  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }

  if (open) {
    syncMobile()
    escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', escListener)
  }
})

onMounted(() => {
  if (!import.meta.client) return
  syncMobile()
  mediaQuery = window.matchMedia('(max-width: 639px)')
  mediaQuery.addEventListener('change', syncMobile)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  if (escListener) {
    window.removeEventListener('keydown', escListener)
    escListener = null
  }
  mediaQuery?.removeEventListener('change', syncMobile)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      @click.self="closeModal"
    >
      <div
        class="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-950/15 sm:max-h-none sm:w-fit sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brevo-custom-range-title"
        @click.stop
      >
        <div
          class="flex shrink-0 justify-center pt-2.5 sm:hidden"
          aria-hidden="true"
        >
          <span class="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-4">
          <div class="min-w-0">
            <h4 id="brevo-custom-range-title" class="text-base font-semibold text-zinc-900">
              Custom range
            </h4>
            <p class="mt-0.5 text-xs text-zinc-500 sm:text-sm">
              Tap start date, then end date. Same day = single day.
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 sm:border-0 sm:bg-transparent sm:shadow-none"
            aria-label="Close"
            @click="closeModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="brevo-custom-range-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <div class="brevo-tracking-range-picker-wrap mx-auto">
            <VueDatePicker
              v-model="range"
              range
              :multi-calendars="!isMobile"
              :dark="false"
              :enable-time-picker="false"
              :time-picker="false"
              :max-date="maxSelectableDate"
              inline
              auto-apply
              @range-end="onRangeEnd"
            />
          </div>

          <p class="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
            <span class="font-semibold text-zinc-900">Selected:</span>
            <span class="break-words">{{ ` ${selectedLabel}` }}</span>
          </p>
        </div>

        <div
          class="flex shrink-0 flex-col gap-2 border-t border-zinc-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:hidden"
        >
          <button
            type="button"
            class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canApply"
            @click="applyRange"
          >
            Apply range
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            @click="dismiss"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.brevo-custom-range-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.brevo-custom-range-scroll::-webkit-scrollbar {
  display: none;
}

.brevo-tracking-range-picker-wrap {
  width: 100%;
  max-width: 100%;
  display: flex;
  justify-content: center;
}

:deep(.brevo-tracking-range-picker-wrap .dp__main) {
  width: 100%;
  max-width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp__menu) {
  background: transparent;
  border: 0;
  width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp__menu_inner) {
  padding: 0;
  width: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

:deep(.brevo-tracking-range-picker-wrap .dp__menu_inner::-webkit-scrollbar) {
  display: none;
}

:deep(.brevo-tracking-range-picker-wrap .dp__instance_calendar) {
  width: 100%;
  max-width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar) {
  padding: 0;
  width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp__month_year_wrap) {
  gap: 12px;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_header) {
  margin-bottom: 6px;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_header_item) {
  width: 36px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #71717a;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_item) {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.brevo-tracking-range-picker-wrap .dp__cell_inner) {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  line-height: 32px;
  font-weight: 500;
}

@media (min-width: 640px) {
  .brevo-tracking-range-picker-wrap {
    width: fit-content;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__main) {
    width: fit-content;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__instance_calendar) {
    width: fit-content;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__month_year_wrap) {
    gap: 18px;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__calendar_header_item) {
    width: 44px;
    height: 34px;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__calendar_item) {
    width: 44px;
    height: 40px;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp__cell_inner) {
    width: 38px;
    height: 38px;
    line-height: 38px;
  }
}

:deep(.brevo-tracking-range-picker-wrap .dp__range_start),
:deep(.brevo-tracking-range-picker-wrap .dp__range_end) {
  background-color: #18181b;
  color: #ffffff;
}

:deep(.brevo-tracking-range-picker-wrap .dp__range_between) {
  background-color: #f4f4f5;
  color: #18181b;
}

:deep(.brevo-tracking-range-picker-wrap .dp__cell_inner:hover) {
  background-color: #f4f4f5;
  color: #18181b;
}

:deep(.brevo-tracking-range-picker-wrap .dp__today) {
  border-color: #18181b;
}

:deep(.brevo-tracking-range-picker-wrap .dp--tp-wrap),
:deep(.brevo-tracking-range-picker-wrap .dp__time_display),
:deep(.brevo-tracking-range-picker-wrap .dp__button_bottom),
:deep(.brevo-tracking-range-picker-wrap .dp__action_extra) {
  display: none !important;
}
</style>
