<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm shadow-slate-900/[0.03] ring-1 ring-slate-900/[0.02] transition-colors hover:border-primary-200/80 hover:bg-primary-50/30"
  >
    <input
      v-model="model"
      type="checkbox"
      class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
    >
    <span class="min-w-0">
      <span class="block text-sm font-medium text-slate-900">Save email template to library</span>
      <span class="mt-0.5 block text-xs leading-relaxed text-slate-500">
        When checked, this design appears under Email templates for reuse in future campaigns.
      </span>
    </span>
  </label>
</template>
