<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <span class="group/ht relative inline-flex max-w-full">
    <slot />
    <span
      role="tooltip"
      class="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[60] hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-zinc-800 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-hover/ht:block group-focus-within/ht:block"
    >
      {{ text }}
    </span>
  </span>
</template>
