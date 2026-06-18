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

const emit = defineEmits<{
  close: []
  apply: []
}>()

function isValidRange(dates: [Date, Date] | null): dates is [Date, Date] {
  if (!dates?.[0] || !dates?.[1]) return false
  return dates[0].getTime() <= dates[1].getTime()
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
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/15 p-4 backdrop-blur-sm"
      @click.self="closeModal"
    >
      <div
        class="w-fit max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-950/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brevo-custom-range-title"
      >
        <div class="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <h4 id="brevo-custom-range-title" class="text-base font-semibold text-zinc-900">
            Select date range
          </h4>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
            @click="closeModal"
          >
            &times;
          </button>
        </div>

        <div class="w-fit space-y-4 px-5 py-5">
          <p class="text-sm text-zinc-500">
            Click a date to set start, then click another to set end. Same date = single day.
          </p>

          <div class="brevo-tracking-range-picker-wrap">
            <VueDatePicker
                v-model="range"
                range
                multi-calendars
                :dark="false"
                :enable-time-picker="false"
                :time-picker="false"
                :max-date="maxSelectableDate"
                inline
                auto-apply
                @range-end="onRangeEnd"
            />
          </div>

          <p class="text-sm text-zinc-700">
            <span class="font-medium text-zinc-900">Selected:</span>
            {{ ` ${selectedLabel}` }}
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.brevo-tracking-range-picker-wrap {
  width: fit-content;
}

:deep(.brevo-tracking-range-picker-wrap .dp__main) {
  width: fit-content;
}

:deep(.brevo-tracking-range-picker-wrap .dp__menu) {
  background: transparent;
  border: 0;
}

:deep(.brevo-tracking-range-picker-wrap .dp__menu_inner) {
  padding: 0;
}

:deep(.brevo-tracking-range-picker-wrap .dp__instance_calendar) {
  width: fit-content;
}

:deep(.brevo-tracking-range-picker-wrap .dp__month_year_wrap) {
  gap: 18px;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar) {
  padding: 0;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_header) {
  margin-bottom: 6px;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_header_item) {
  width: 44px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #71717a;
}

:deep(.brevo-tracking-range-picker-wrap .dp__calendar_item) {
  width: 44px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.brevo-tracking-range-picker-wrap .dp__cell_inner) {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  line-height: 38px;
  font-weight: 500;
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
