<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    text: string
    /** Where the tip appears relative to the trigger. */
    placement?: 'bottom' | 'right'
  }>(),
  { placement: 'bottom' }
)

const open = ref(false)

function show() {
  open.value = true
}

function hide() {
  open.value = false
}

/** Click selects a control; drop the tip and blur so it doesn't stick open. */
function onPointerDown() {
  open.value = false
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

const tipClass = computed(() =>
  props.placement === 'right'
    ? 'pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[60] w-max max-w-[16rem] -translate-y-1/2 rounded-md bg-zinc-800 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg'
    : 'pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[60] w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-zinc-800 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg'
)
</script>

<template>
  <span
    class="relative inline-flex max-w-full"
    :class="placement === 'right' ? 'w-full' : ''"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @pointerdown="onPointerDown"
  >
    <slot />
    <span
      v-show="open"
      role="tooltip"
      :class="tipClass"
    >
      {{ text }}
    </span>
  </span>
</template>
