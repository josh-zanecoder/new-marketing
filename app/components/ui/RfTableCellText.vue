<script setup lang="ts">
import { TENANT_TAB_CELL_CHAR_LIMIT } from '~/utils/truncateTabCellText'

const props = withDefaults(
  defineProps<{
    text?: string | null
    limit?: number
    emptyLabel?: string
    monospace?: boolean
  }>(),
  {
    limit: TENANT_TAB_CELL_CHAR_LIMIT,
    emptyLabel: '—'
  }
)

const expanded = ref(false)

const raw = computed(() => String(props.text ?? '').trim())

const isOverflow = computed(() => raw.value.length > props.limit)

const displayText = computed(() => {
  if (!raw.value) return props.emptyLabel
  if (expanded.value || !isOverflow.value) return raw.value
  return `${raw.value.slice(0, props.limit)}…`
})
</script>

<template>
  <div
    class="rf-cell-expand"
    :class="{ 'rf-cell-expand--open': expanded }"
  >
    <div
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
      v-if="isOverflow"
      type="button"
      class="rf-cell-expand__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'View less' : 'View more' }}
    </button>
  </div>
</template>
