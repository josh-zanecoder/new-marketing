<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  reasons: readonly string[]
  heading: string
}>()

const emphasized = ref(false)
const rootRef = ref<HTMLElement | null>(null)

let emphasisTimer: ReturnType<typeof setTimeout> | undefined

function clearEmphasisTimer() {
  if (emphasisTimer !== undefined) {
    clearTimeout(emphasisTimer)
    emphasisTimer = undefined
  }
}

function resetEmphasis() {
  clearEmphasisTimer()
  emphasized.value = false
}

function emphasize() {
  if (!props.visible) return
  emphasized.value = true
  clearEmphasisTimer()
  emphasisTimer = setTimeout(() => {
    emphasized.value = false
  }, 2000)
  nextTick(() => {
    rootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) resetEmphasis()
  }
)

onBeforeUnmount(resetEmphasis)

defineExpose({ emphasize })
</script>

<template>
  <div
    v-if="visible"
    ref="rootRef"
    class="flex gap-3.5 rounded-2xl px-5 py-4 text-sm text-amber-950 shadow-sm transition-all duration-300 sm:text-[0.9375rem]"
    :class="emphasized
      ? 'border-2 border-amber-500 bg-amber-100 shadow-lg shadow-amber-500/20 ring-4 ring-amber-300/50'
      : 'border border-amber-200/90 bg-amber-50/90'"
    role="status"
  >
    <div class="mt-0.5 shrink-0" :class="emphasized ? 'text-amber-700' : 'text-amber-600'">
      <svg
        class="h-5 w-5 transition-transform"
        :class="{ 'scale-110': emphasized }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    </div>
    <div>
      <p class="font-semibold text-amber-950">
        {{ heading }}
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-amber-900/90">
        <li v-for="(reason, reasonIdx) in reasons" :key="reasonIdx">
          {{ reason }}
        </li>
      </ul>
    </div>
  </div>
</template>
