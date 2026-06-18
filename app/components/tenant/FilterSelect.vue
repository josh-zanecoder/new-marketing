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
  const root = rootRef.value
  if (!root || !open.value) return
  if (event.target instanceof Node && root.contains(event.target)) return
  open.value = false
}

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled) open.value = false
  }
)

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
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

    <div
      v-show="open"
      class="absolute left-0 right-0 z-30 mt-2 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
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
  </div>
</template>
