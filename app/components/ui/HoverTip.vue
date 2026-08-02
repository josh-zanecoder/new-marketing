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
const rootRef = ref<HTMLElement | null>(null)
const tipStyle = ref<Record<string, string>>({})

const VIEWPORT_PAD = 8
const GAP = 6

function show() {
  open.value = true
  nextTick(() => updatePosition())
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

function updatePosition() {
  if (!import.meta.client || !open.value || !rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxW = Math.min(16 * 16, vw - VIEWPORT_PAD * 2) // 16rem, clamped

  if (props.placement === 'right') {
    let left = rect.right + 8
      const top = rect.top + rect.height / 2
    // Prefer right; flip left if near the edge
    if (left + Math.min(maxW, 200) > vw - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, rect.left - 8)
      tipStyle.value = {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translate(-100%, -50%)',
        maxWidth: `${maxW}px`
      }
      return
    }
    tipStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      transform: 'translateY(-50%)',
      maxWidth: `${maxW}px`
    }
    return
  }

  // bottom: center under trigger, then clamp horizontally into the viewport
  let left = rect.left + rect.width / 2
  const top = rect.bottom + GAP
  const halfMax = maxW / 2
  left = Math.min(Math.max(left, VIEWPORT_PAD + halfMax), vw - VIEWPORT_PAD - halfMax)

  // If near bottom of viewport, flip above
  const preferBelow = top + 48 < vh - VIEWPORT_PAD
  tipStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: preferBelow ? `${top}px` : `${Math.max(VIEWPORT_PAD, rect.top - GAP)}px`,
    transform: preferBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    maxWidth: `${maxW}px`
  }
}

function onScrollOrResize() {
  if (open.value) updatePosition()
}

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<template>
  <span
    ref="rootRef"
    class="relative inline-flex max-w-full"
    :class="placement === 'right' ? 'w-full' : ''"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @pointerdown="onPointerDown"
  >
    <slot />
    <Teleport to="body">
      <span
        v-show="open"
        role="tooltip"
        class="pointer-events-none z-[200] w-max rounded-md bg-zinc-800 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        :style="tipStyle"
      >
        {{ text }}
      </span>
    </Teleport>
  </span>
</template>
