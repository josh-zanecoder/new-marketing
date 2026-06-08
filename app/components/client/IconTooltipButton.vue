<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
    buttonClass?: string
  }>(),
  {
    disabled: false,
    buttonClass: ''
  }
)

const emit = defineEmits<{
  click: [MouseEvent]
}>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    class="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
    :class="buttonClass"
    @click="emit('click', $event)"
  >
    <slot />
    <span
      role="tooltip"
      class="pointer-events-none absolute bottom-[calc(100%+0.375rem)] left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-none text-white shadow-lg group-hover:block group-focus-visible:block"
    >
      {{ label }}
      <span
        class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"
        aria-hidden="true"
      />
    </span>
  </button>
</template>
