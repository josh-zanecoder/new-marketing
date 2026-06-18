<script setup lang="ts">
import {
  BREVO_TRACKING_DATE_PRESET_OPTIONS,
  type BrevoTrackingDatePresetId,
  toYmdLocal,
  ymdRangeToDates
} from '~/composables/useBrevoTrackingDateRange'

const datePreset = defineModel<BrevoTrackingDatePresetId>('preset', { required: true })
const customDateFrom = defineModel<string>('customFrom', { required: true })
const customDateTo = defineModel<string>('customTo', { required: true })

defineProps<{
  label: string
}>()

const open = ref(false)
const showCustomRangeModal = ref(false)
const modalRange = ref<[Date, Date] | null>(null)
const rootRef = ref<HTMLElement | null>(null)

function selectPreset(id: BrevoTrackingDatePresetId) {
  if (id === 'custom') {
    openCustomRangeModal()
    open.value = false
    return
  }

  datePreset.value = id
  customDateFrom.value = ''
  customDateTo.value = ''
  open.value = false
}

function openCustomRangeModal() {
  modalRange.value = ymdRangeToDates(customDateFrom.value, customDateTo.value)
  showCustomRangeModal.value = true
}

function closeCustomRangeModal() {
  showCustomRangeModal.value = false
}

function applyCustomRange() {
  if (!modalRange.value?.[0] || !modalRange.value?.[1]) return
  if (modalRange.value[0].getTime() > modalRange.value[1].getTime()) return

  customDateFrom.value = toYmdLocal(modalRange.value[0])
  customDateTo.value = toYmdLocal(modalRange.value[1])
  datePreset.value = 'custom'
  showCustomRangeModal.value = false
}

function onDocumentPointerDown(event: MouseEvent) {
  const root = rootRef.value
  if (!root || !open.value || showCustomRangeModal.value) return
  if (event.target instanceof Node && root.contains(event.target)) return
  open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="relative shrink-0">
    <label class="sr-only" for="brevo-tracking-date-range">Date range</label>
    <button
      id="brevo-tracking-date-range"
      type="button"
      class="inline-flex w-full min-w-[11rem] items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-800 shadow-sm shadow-zinc-950/5 transition hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:w-auto"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <span class="min-w-0 truncate">{{ label }}</span>
      <svg
        class="h-4 w-4 shrink-0 text-zinc-400 transition-transform"
        :class="{ 'rotate-180': open }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-show="open"
      class="absolute right-0 z-30 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-950/10 sm:w-72"
      role="listbox"
      aria-label="Date range options"
    >
      <ul class="max-h-72 overflow-y-auto py-1">
        <li v-for="option in BREVO_TRACKING_DATE_PRESET_OPTIONS" :key="option.id">
          <button
            type="button"
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-zinc-50"
            :class="
              datePreset === option.id
                ? 'bg-zinc-50 font-semibold text-zinc-900'
                : 'font-medium text-zinc-700'
            "
            role="option"
            :aria-selected="datePreset === option.id"
            @click="selectPreset(option.id)"
          >
            {{ option.label }}
            <svg
              v-if="datePreset === option.id"
              class="h-4 w-4 shrink-0 text-zinc-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </li>
      </ul>
    </div>

    <TenantBrevoTrackingCustomRangeModal
      v-model:visible="showCustomRangeModal"
      v-model:range="modalRange"
      @close="closeCustomRangeModal"
      @apply="applyCustomRange"
    />
  </div>
</template>
