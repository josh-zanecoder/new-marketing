<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    items: string[]
    formatItem?: (item: string) => string
  }>(),
  {
    formatItem: (item: string) => item
  }
)

const expanded = ref(false)
const listRef = ref<HTMLElement | null>(null)
const overflowing = ref(false)

function updateOverflow() {
  if (expanded.value) {
    overflowing.value = false
    return
  }
  const el = listRef.value
  if (!el) {
    overflowing.value = false
    return
  }
  overflowing.value = el.scrollHeight > el.clientHeight + 1
}

watch(expanded, () => nextTick(updateOverflow))

watch(
  () => props.items,
  () => nextTick(updateOverflow),
  { deep: true }
)

onMounted(() => {
  nextTick(updateOverflow)
  if (typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver(() => updateOverflow())
  watch(
    listRef,
    (el, _, onCleanup) => {
      if (el) ro.observe(el)
      onCleanup(() => ro.disconnect())
    },
    { immediate: true }
  )
})
</script>

<template>
  <div v-if="items.length" class="rf-cell-expand" :class="{ 'rf-cell-expand--open': expanded }">
    <div
      ref="listRef"
      class="value-chip-list"
      :class="{ 'value-chip-list--expanded': expanded }"
    >
      <span
        v-for="(item, i) in items"
        :key="`${item}-${i}`"
        class="value-chip"
      >{{ formatItem(item) }}</span>
    </div>
    <button
      v-if="overflowing || expanded"
      type="button"
      class="rf-cell-expand__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'View less' : 'View more' }}
    </button>
  </div>
  <span v-else class="td-muted">—</span>
</template>
