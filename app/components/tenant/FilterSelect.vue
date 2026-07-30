<script setup lang="ts">
export type FilterSelectOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    options: readonly FilterSelectOption[]
    disabled?: boolean
    /** `filter` = toolbar filters; `field` = form fields inside cards/modals; `tracking` = Brevo tracking toolbar */
    variant?: 'filter' | 'field' | 'tracking'
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
const searchInputRef = ref<HTMLInputElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const searchQuery = ref('')

const selectedLabel = computed(() => {
  const match = props.options.find((option) => option.value === model.value)
  if (match) return match.label
  return props.options[0]?.label ?? 'Select…'
})

/** Show search once the list is long enough that scrolling alone is awkward. */
const searchable = computed(() => props.options.length > 6)

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((option) => {
    const label = String(option.label ?? '').toLowerCase()
    const value = String(option.value ?? '').toLowerCase()
    return label.includes(q) || value.includes(q)
  })
})

const triggerClass = computed(() => {
  if (props.variant === 'field') {
    return 'relative flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-2.5 pl-3 pr-10 text-left text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
  }
  if (props.variant === 'tracking') {
    return 'inline-flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-2xl border border-zinc-200/90 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-800 shadow-sm shadow-zinc-950/5 transition hover:border-zinc-300 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 sm:w-auto sm:justify-start sm:gap-1.5 disabled:cursor-not-allowed disabled:opacity-50'
  }
  return 'relative flex w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-3.5 pl-4 pr-10 text-left text-[0.9375rem] font-medium text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors focus:border-primary-300 focus:outline-none focus:ring-[3px] focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
})

const rootClass = computed(() =>
  props.variant === 'tracking'
    ? 'relative w-full shrink-0 sm:w-fit'
    : 'relative min-w-0 w-full max-w-full'
)

const chevronClass = computed(() =>
  props.variant === 'tracking'
    ? 'h-4 w-4 shrink-0 text-zinc-400 transition-transform'
    : 'pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform'
)

function updatePanelPosition() {
  const root = rootRef.value
  if (!root || !import.meta.client) return
  const rect = root.getBoundingClientRect()
  const viewportPadding = 8
  const gap = 8
  const maxPanelHeight = searchable.value ? 320 : 240
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

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    open.value = false
  }
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
    searchQuery.value = ''
    nextTick(() => {
      updatePanelPosition()
      if (searchable.value) searchInputRef.value?.focus()
    })
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    searchQuery.value = ''
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
  <div ref="rootRef" :class="rootClass">
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
        :class="[chevronClass, { 'rotate-180': open }]"
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
        class="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
        :style="panelStyle"
        role="listbox"
        :aria-label="label"
      >
        <div
          v-if="searchable"
          class="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white p-2"
        >
          <label class="sr-only" :for="`${id}-search`">Search {{ label }}</label>
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              :id="`${id}-search`"
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              autocomplete="off"
              placeholder="Search…"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              @keydown="onSearchKeydown"
              @click.stop
              @mousedown.stop
            >
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          <p
            v-if="!filteredOptions.length"
            class="px-4 py-3 text-sm text-slate-500"
          >
            No matches
          </p>
          <button
            v-for="option in filteredOptions"
            :key="`${option.value}-${option.label}`"
            type="button"
            class="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            :class="model === option.value ? 'bg-primary-50/80 font-semibold text-primary-900' : 'font-medium text-slate-800'"
            role="option"
            :aria-selected="model === option.value"
            :disabled="disabled"
            @click="selectOption(option.value)"
          >
            <span class="min-w-0 truncate">{{ option.label }}</span>
            <svg
              v-if="model === option.value"
              class="h-4 w-4 shrink-0 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
