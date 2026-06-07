<template>
  <div
    class="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-sm text-slate-500">
      <template v-if="total === 0">
        No {{ itemLabel }} to show
      </template>
      <template v-else>
        Showing {{ rangeStart }}–{{ rangeEnd }} of {{ total }} {{ itemLabel }}
      </template>
    </p>
    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page <= 1 || loading"
        @click="emit('update:page', page - 1)"
      >
        Previous
      </button>
      <span class="min-w-[7rem] text-center text-sm tabular-nums text-slate-500">
        Page {{ page }} / {{ totalPages }}
      </span>
      <button
        type="button"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="page >= totalPages || loading || total === 0"
        @click="emit('update:page', page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    page: number
    totalPages: number
    total: number
    limit: number
    loading?: boolean
    itemLabel?: string
  }>(),
  {
    loading: false,
    itemLabel: 'items'
  }
)

const emit = defineEmits<{
  'update:page': [number]
}>()

const rangeStart = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.limit + 1
)
const rangeEnd = computed(() => Math.min(props.page * props.limit, props.total))
</script>
