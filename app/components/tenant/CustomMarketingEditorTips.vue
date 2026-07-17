<script setup lang="ts">
import { useCustomMarketingEditorTips } from '~/composables/useCustomMarketingEditorTips'

const { heading, tips } = useCustomMarketingEditorTips()
</script>

<template>
  <aside
    class="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 shadow-sm shadow-slate-900/[0.02] ring-1 ring-slate-900/[0.02] sm:px-3.5"
    aria-label="Message writing tips"
  >
    <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {{ heading }}
    </p>
    <ul class="mt-1.5 grid gap-1.5 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1.5">
      <li
        v-for="tip in tips"
        :key="tip.id"
        class="flex items-start gap-2"
      >
        <span
          class="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-500"
          aria-hidden="true"
        >
          <component :is="tip.icon" :size="11" :stroke-width="2" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-semibold leading-tight text-slate-800">
            {{ tip.title }}
            <span class="font-normal text-slate-500"> — {{ tip.body }}</span>
            <code
              v-if="tip.example"
              class="ml-1 inline rounded bg-white px-1 py-px font-mono text-[10px] font-normal text-slate-600 ring-1 ring-slate-200/90"
            >{{ tip.example }}</code>
          </p>
        </div>
      </li>
    </ul>
  </aside>
</template>
