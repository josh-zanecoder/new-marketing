<script setup lang="ts">
import { VueDatePicker } from '@vuepic/vue-datepicker'
import {
  BREVO_TRACKING_DATE_PRESET_OPTIONS,
  BREVO_TRACKING_DEFAULT_PRESET,
  presetToBrevoTrackingRange,
  toYmdLocal,
  type BrevoTrackingDatePresetId,
  ymdRangeToDates
} from '~/composables/useBrevoTrackingDateRange'

const datePreset = defineModel<BrevoTrackingDatePresetId>('preset', { required: true })
const customDateFrom = defineModel<string>('customFrom', { required: true })
const customDateTo = defineModel<string>('customTo', { required: true })

const props = defineProps<{
  label: string
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const calendarRange = ref<[Date, Date] | null>(null)
/** Single month below `md`; dual calendars from `md` up. */
const isCompact = ref(false)
const panelStyle = ref<Record<string, string>>({})
let mediaQuery: MediaQueryList | null = null

const maxSelectableDate = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
})

const rangeInputValue = computed(() => props.label)
const useDualCalendars = computed(() => !isCompact.value)

function syncCompact() {
  if (!import.meta.client) return
  isCompact.value = window.matchMedia('(max-width: 767px)').matches
}

function updatePanelPosition() {
  if (!import.meta.client || isCompact.value) {
    panelStyle.value = {}
    return
  }

  const root = rootRef.value
  const panel = panelRef.value
  if (!root) {
    panelStyle.value = {}
    return
  }

  const rect = root.getBoundingClientRect()
  const gap = 8
  const viewportPad = 12
  const panelWidth = panel?.offsetWidth || 640
  const panelHeight = panel?.offsetHeight || 420
  const maxLeft = window.innerWidth - panelWidth - viewportPad
  const left = Math.max(viewportPad, Math.min(rect.left, maxLeft))

  const spaceBelow = window.innerHeight - rect.bottom - viewportPad
  const spaceAbove = rect.top - viewportPad
  const openUp = spaceBelow < Math.min(panelHeight, 360) && spaceAbove > spaceBelow

  if (openUp) {
    panelStyle.value = {
      left: `${left}px`,
      bottom: `${window.innerHeight - rect.top + gap}px`,
      top: 'auto',
      maxWidth: `${Math.min(panelWidth, window.innerWidth - viewportPad * 2)}px`
    }
    return
  }

  panelStyle.value = {
    left: `${left}px`,
    top: `${rect.bottom + gap}px`,
    bottom: 'auto',
    maxWidth: `${Math.min(panelWidth, window.innerWidth - viewportPad * 2)}px`
  }
}

function syncCalendarFromModels() {
  if (datePreset.value === 'custom') {
    calendarRange.value = ymdRangeToDates(customDateFrom.value, customDateTo.value)
    return
  }
  const range = presetToBrevoTrackingRange(datePreset.value)
  if (range.from && range.to) {
    calendarRange.value = ymdRangeToDates(range.from, range.to)
    return
  }
  calendarRange.value = null
}

function selectPreset(id: BrevoTrackingDatePresetId) {
  datePreset.value = id
  customDateFrom.value = ''
  customDateTo.value = ''
  syncCalendarFromModels()
}

function applyCalendarRange(dates: [Date, Date] | null) {
  if (!dates?.[0] || !dates?.[1]) return
  if (dates[0].getTime() > dates[1].getTime()) return
  customDateFrom.value = toYmdLocal(dates[0])
  customDateTo.value = toYmdLocal(dates[1])
  datePreset.value = 'custom'
  calendarRange.value = dates
}

function onRangeEnd(dates: [Date, Date] | null) {
  applyCalendarRange(dates)
}

function clearToDefault(event: MouseEvent) {
  event.stopPropagation()
  datePreset.value = BREVO_TRACKING_DEFAULT_PRESET
  customDateFrom.value = ''
  customDateTo.value = ''
  syncCalendarFromModels()
}

function toggleOpen() {
  open.value = !open.value
}

function closePanel() {
  open.value = false
}

function onDocumentPointerDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (rootRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  open.value = false
}

function onViewportChange() {
  if (!open.value) return
  syncCompact()
  nextTick(() => updatePanelPosition())
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  document.body.style.overflow = isOpen && isCompact.value ? 'hidden' : ''

  if (isOpen) {
    syncCompact()
    syncCalendarFromModels()
    await nextTick()
    updatePanelPosition()
    // Remeasure after calendar paints (dual month width).
    requestAnimationFrame(() => updatePanelPosition())
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})

watch(isCompact, async (compact) => {
  if (!import.meta.client) return
  if (open.value) {
    document.body.style.overflow = compact ? 'hidden' : ''
    await nextTick()
    updatePanelPosition()
  }
})

onMounted(() => {
  syncCompact()
  mediaQuery = window.matchMedia('(max-width: 767px)')
  mediaQuery.addEventListener('change', syncCompact)
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncCompact)
  document.removeEventListener('mousedown', onDocumentPointerDown)
  if (import.meta.client) {
    document.body.style.overflow = ''
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})
</script>

<template>
  <div ref="rootRef" class="relative w-full min-w-0 shrink-0 sm:w-auto">
    <label class="sr-only" for="brevo-tracking-date-range">Date range</label>
    <button
      id="brevo-tracking-date-range"
      type="button"
      class="inline-flex w-full max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white py-2 pl-3.5 pr-2.5 text-left text-sm text-zinc-800 shadow-sm shadow-zinc-950/[0.04] transition hover:border-zinc-300 focus:border-[#6E56CF] focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/25 sm:w-auto sm:min-w-[15rem] sm:pl-4 sm:pr-3"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggleOpen"
    >
      <span class="min-w-0 flex-1 truncate font-medium tabular-nums tracking-tight">{{ label }}</span>
      <span
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        role="button"
        tabindex="-1"
        aria-label="Reset to Last 7 Days"
        @click="clearToDefault"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
      <svg class="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.75"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open && isCompact"
        class="fixed inset-0 z-[199] bg-zinc-950/40 backdrop-blur-[1px]"
        aria-hidden="true"
        @click="closePanel"
      />

      <div
        v-if="open"
        ref="panelRef"
        class="brevo-date-panel z-[200] flex flex-col overflow-hidden border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-950/15"
        :class="
          isCompact
            ? 'fixed inset-x-0 bottom-0 max-h-[min(92dvh,40rem)] rounded-t-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]'
            : 'fixed max-h-[min(85dvh,36rem)] w-max max-w-[calc(100vw-1.5rem)] rounded-2xl sm:flex-row'
        "
        role="dialog"
        aria-label="Choose date range"
        :style="isCompact ? undefined : panelStyle"
      >
        <div
          v-if="isCompact"
          class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 pb-3 pt-2.5"
        >
          <div class="flex min-w-0 flex-1 flex-col items-center">
            <span class="mb-2 h-1 w-10 rounded-full bg-zinc-200" aria-hidden="true" />
            <p class="w-full text-sm font-semibold text-zinc-900">Date range</p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-800"
            aria-label="Close"
            @click="closePanel"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <aside
          class="flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain border-b border-zinc-100 p-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 md:w-[11.5rem] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4 [&::-webkit-scrollbar]:hidden"
          :class="isCompact ? 'flex-row' : 'md:flex-col'"
          aria-label="Date presets"
        >
          <button
            v-for="option in BREVO_TRACKING_DATE_PRESET_OPTIONS"
            :key="option.id"
            type="button"
            class="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition md:w-full"
            :class="
              datePreset === option.id
                ? 'border-[#6E56CF] bg-[#6E56CF]/10 text-[#5B45B8]'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
            "
            @click="selectPreset(option.id)"
          >
            {{ option.label }}
          </button>
        </aside>

        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <div class="shrink-0 border-b border-zinc-100 px-3 py-3 sm:px-4">
            <label class="sr-only" for="brevo-date-range-input">Selected range</label>
            <input
              id="brevo-date-range-input"
              type="text"
              readonly
              :value="rangeInputValue"
              class="w-full rounded-xl border border-[#6E56CF] bg-white px-3.5 py-2.5 text-sm font-medium tabular-nums text-zinc-900 shadow-sm outline-none ring-2 ring-[#6E56CF]/15"
            >
          </div>

          <div
            class="brevo-tracking-range-picker-wrap min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain p-2 sm:p-3"
            :class="{ 'brevo-tracking-range-picker-wrap--compact': isCompact }"
          >
            <VueDatePicker
              :key="useDualCalendars ? 'dual' : 'single'"
              v-model="calendarRange"
              range
              :multi-calendars="useDualCalendars"
              :dark="false"
              :enable-time-picker="false"
              :time-picker="false"
              :max-date="maxSelectableDate"
              :month-change-on-scroll="false"
              :week-start="1"
              inline
              auto-apply
              @range-end="onRangeEnd"
              @update:model-value="applyCalendarRange"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.brevo-tracking-range-picker-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  --dp-primary-color: #6e56cf;
  --dp-primary-text-color: #ffffff;
  --dp-hover-color: #efeafc;
  --dp-hover-text-color: #3f2f7a;
  --dp-range-between-dates-background-color: #efeafc;
  --dp-range-between-dates-text-color: #3f2f7a;
  --dp-cell-border-radius: 9999px;
  --dp-icon-color: #6e56cf;
  --dp-font-size: 0.875rem;
  --dp-cell-size: 36px;
}

.brevo-tracking-range-picker-wrap--compact {
  --dp-cell-size: 40px;
  --dp-font-size: 0.9375rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--main) {
  width: 100%;
  max-width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp--menu) {
  background: transparent;
  border: 0;
  width: 100%;
  max-width: 100%;
  box-shadow: none;
}

:deep(.brevo-tracking-range-picker-wrap .dp--menu-inner) {
  padding: 0;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--instance-calendar) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex: 1 1 16rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--calendar) {
  padding: 0;
  width: 100%;
}

:deep(.brevo-tracking-range-picker-wrap .dp--calendar-row),
:deep(.brevo-tracking-range-picker-wrap .dp--calendar-header) {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

:deep(.brevo-tracking-range-picker-wrap .dp--calendar-header-item),
:deep(.brevo-tracking-range-picker-wrap .dp--calendar-item) {
  flex: 1 1 0;
  min-width: 0;
  height: auto;
  aspect-ratio: 1;
  max-width: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

:deep(.brevo-tracking-range-picker-wrap .dp--calendar-header-item) {
  font-weight: 600;
  color: #71717a;
  font-size: 0.7rem;
  aspect-ratio: auto;
  height: 1.75rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--cell-inner) {
  width: 85%;
  max-width: 2.25rem;
  height: auto;
  aspect-ratio: 1;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  line-height: 1;
}

@media (min-width: 768px) {
  .brevo-tracking-range-picker-wrap {
    width: fit-content;
    --dp-cell-size: 38px;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp--main),
  :deep(.brevo-tracking-range-picker-wrap .dp--menu),
  :deep(.brevo-tracking-range-picker-wrap .dp--menu-inner) {
    width: fit-content;
    max-width: none;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp--instance-calendar) {
    width: fit-content;
    flex: 0 0 auto;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp--calendar-header-item),
  :deep(.brevo-tracking-range-picker-wrap .dp--calendar-item) {
    width: 2.5rem;
    max-width: 2.5rem;
    flex: 0 0 2.5rem;
  }

  :deep(.brevo-tracking-range-picker-wrap .dp--cell-inner) {
    width: 2.15rem;
    max-width: 2.15rem;
  }
}

:deep(.brevo-tracking-range-picker-wrap .dp--active) {
  background-color: #6e56cf;
  color: #ffffff;
  border-radius: 9999px;
}

:deep(.brevo-tracking-range-picker-wrap .dp--range-between),
:deep(.brevo-tracking-range-picker-wrap .dp--cell-in-between) {
  background-color: #efeafc;
  color: #3f2f7a;
}

:deep(.brevo-tracking-range-picker-wrap .dp--today) {
  border-color: #6e56cf;
}

:deep(.brevo-tracking-range-picker-wrap .dp--arrow-top),
:deep(.brevo-tracking-range-picker-wrap .dp--arrow-bottom) {
  display: none;
}

:deep(.brevo-tracking-range-picker-wrap .dp--month-year-row) {
  gap: 0.25rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--month-year-select) {
  color: #18181b;
  font-weight: 600;
  font-size: 0.875rem;
}

:deep(.brevo-tracking-range-picker-wrap .dp--action-row),
:deep(.brevo-tracking-range-picker-wrap .dp--button-bottom) {
  display: none !important;
}
</style>
