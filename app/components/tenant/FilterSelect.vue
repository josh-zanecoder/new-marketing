<script setup lang="ts">
export type FilterSelectOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    options: FilterSelectOption[]
    disabled?: boolean
    /** `filter` = toolbar filters; `field` = form fields inside cards/modals */
    variant?: 'filter' | 'field'
  }>(),
  { disabled: false, variant: 'filter' }
)

const model = defineModel<string>({ required: true })

const emit = defineEmits<{
  'before-select': []
  change: [value: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  const match = props.options.find((option) => option.value === model.value)
  if (match) return match.label
  return props.options[0]?.label ?? 'Select…'
})

const triggerClass = computed(() => {
  if (props.variant === 'field') {
    return 'relative flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-2.5 pl-3 pr-10 text-left text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
  }
  return 'relative flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-left text-[0.9375rem] font-medium text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
})

function updatePanelPosition() {
  const root = rootRef.value
  if (!root || !import.meta.client) return
  const rect = root.getBoundingClientRect()
  const viewportPadding = 8
  const gap = 8
  const maxPanelHeight = 240
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportPadding
  const openUp = spaceBelow < Math.min(maxPanelHeight, 160) && spaceAbove > spaceBelow
  const maxHeight = openUp
    ? Math.min(maxPanelHeight, spaceAbove - gap)
    : Math.min(maxPanelHeight, spaceBelow - gap)

  const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding))

  if (openUp) {
    panelStyle.value = {
      bottom: `${window.innerHeight - rect.top + gap}px`,
      left: `${left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.max(maxHeight, 120)}px`
    }
    return
  }

  panelStyle.value = {
    top: `${rect.bottom + gap}px`,
    left: `${left}px`,
    width: `${rect.width}px`,
    maxHeight: `${Math.max(maxHeight, 120)}px`
  }
}

function selectOption(value: string) {
  if (props.disabled) return
  emit('before-select')
  model.value = value
  emit('change', value)
  open.value = false
}

function toggleOpen() {
  if (props.disabled) return
  if (!open.value) emit('before-select')
  open.value = !open.value
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
  updatePanelPosition()
}

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled) open.value = false
  }
)

watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    nextTick(() => updatePanelPosition())
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})

watch(
  () => props.options,
  () => {
    if (open.value) nextTick(() => updatePanelPosition())
  },
  { deep: true }
)

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  if (import.meta.client) {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 w-full max-w-full">
    <label class="sr-only" :for="id">{{ label }}</label>
    <button
      :id="id"
      type="button"
      :class="triggerClass"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggleOpen"
    >
      <span class="min-w-0 truncate">{{ selectedLabel }}</span>
      <svg
        class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform"
        :class="{ 'rotate-180': open }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-show="open"
        ref="panelRef"
        class="fixed z-[200] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
        :style="panelStyle"
        role="listbox"
        :aria-label="label"
      >
        <button
          v-for="option in options"
          :key="`${option.value}-${option.label}`"
          type="button"
          class="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          :class="model === option.value ? 'bg-indigo-50/80 font-semibold text-indigo-900' : 'font-medium text-slate-800'"
          role="option"
          :aria-selected="model === option.value"
          :disabled="disabled"
          @click="selectOption(option.value)"
        >
          <span class="min-w-0 truncate">{{ option.label }}</span>
          <svg
            v-if="model === option.value"
            class="h-4 w-4 shrink-0 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </Teleport>
  </div>
</template>
