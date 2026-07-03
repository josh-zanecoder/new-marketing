<script setup lang="ts">
import { TENANT_TAB_CELL_CHAR_LIMIT } from '~/utils/truncateTabCellText'

const props = withDefaults(
  defineProps<{
    text?: string | null
    limit?: number
    emptyLabel?: string
    monospace?: boolean
    ellipsis?: boolean
    lines?: number
  }>(),
  {
    limit: TENANT_TAB_CELL_CHAR_LIMIT,
    emptyLabel: '—',
    lines: 1
  }
)

const expanded = ref(false)
const textRef = ref<HTMLElement | null>(null)
const overflowing = ref(false)

const raw = computed(() => String(props.text ?? '').trim())

const clampLines = computed(() =>
  props.ellipsis && props.lines > 1 ? props.lines : 0
)

const isOverflow = computed(() => {
  if (props.ellipsis) return overflowing.value
  return raw.value.length > props.limit
})

const showToggle = computed(() => {
  if (props.ellipsis) return overflowing.value || expanded.value
  return isOverflow.value
})

const displayText = computed(() => {
  if (!raw.value) return props.emptyLabel
  if (props.ellipsis || expanded.value || !isOverflow.value) return raw.value
  return `${raw.value.slice(0, props.limit)}…`
})

function updateOverflow() {
  if (!props.ellipsis || expanded.value) {
    overflowing.value = false
    return
  }
  const el = textRef.value
  if (!el) {
    overflowing.value = false
    return
  }
  if (clampLines.value) {
    overflowing.value = el.scrollHeight > el.clientHeight + 1
    return
  }
  overflowing.value = el.scrollWidth > el.clientWidth + 1
}

watch(expanded, () => nextTick(updateOverflow))

watch(
  () => props.text,
  () => nextTick(updateOverflow)
)

watch(
  () => props.ellipsis,
  () => nextTick(updateOverflow)
)

watch(
  () => props.lines,
  () => nextTick(updateOverflow)
)

onMounted(() => {
  nextTick(updateOverflow)
  if (!props.ellipsis || typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver(() => updateOverflow())
  watch(
    textRef,
    (el, _, onCleanup) => {
      if (el) ro.observe(el)
      onCleanup(() => ro.disconnect())
    },
    { immediate: true }
  )
})
</script>

<template>
  <div
    class="rf-cell-expand"
    :class="{
      'rf-cell-expand--open': expanded,
      'rf-cell-expand--ellipsis': ellipsis && !clampLines,
      'rf-cell-expand--clamp': !!clampLines
    }"
    :style="clampLines ? { '--rf-cell-clamp-lines': clampLines } : undefined"
  >
    <div
      ref="textRef"
      class="rf-cell-expand__text"
      :class="{ 'rf-cell-expand__text--mono': monospace }"
      :title="raw || undefined"
    >
      <slot :text="displayText" :raw="raw">
        <code v-if="monospace">{{ displayText }}</code>
        <template v-else>{{ displayText }}</template>
      </slot>
    </div>
    <button
      v-if="showToggle"
      type="button"
      class="rf-cell-expand__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'View less' : 'View more' }}
    </button>
  </div>
</template>
