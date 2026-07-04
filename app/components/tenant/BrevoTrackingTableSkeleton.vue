<script setup lang="ts">
withDefaults(
  defineProps<{
    mobileRows?: number
    desktopRows?: number
  }>(),
  {
    mobileRows: 3,
    desktopRows: 5
  }
)
</script>

<template>
  <div class="animate-pulse" aria-hidden="true">
    <div class="hidden border-b border-zinc-200 bg-zinc-50/90 px-6 py-3.5 lg:block">
      <div class="flex gap-8">
        <div v-for="n in 5" :key="`head-${n}`" class="h-3 w-16 rounded bg-zinc-100" />
      </div>
    </div>

    <ul class="divide-y divide-zinc-100 lg:hidden">
      <li v-for="n in mobileRows" :key="`mobile-${n}`" class="space-y-2 p-4">
        <div class="h-3 w-16 rounded bg-zinc-100" />
        <div class="h-4 w-full max-w-[12rem] rounded bg-zinc-100" />
        <div class="h-4 w-full max-w-sm rounded bg-zinc-100" />
        <div class="h-3 w-28 rounded bg-zinc-100" />
        <div class="flex gap-1.5 pt-1">
          <div class="h-6 w-16 rounded-full bg-zinc-100" />
          <div class="h-6 w-14 rounded-full bg-zinc-100" />
        </div>
      </li>
    </ul>

    <div class="hidden lg:block">
      <div
        v-for="n in desktopRows"
        :key="`desktop-${n}`"
        class="flex items-center gap-6 border-b border-zinc-100 px-6 py-4 last:border-b-0"
      >
        <div class="h-4 w-24 rounded bg-zinc-100" />
        <div class="h-4 w-32 rounded bg-zinc-100" />
        <div class="h-4 w-40 rounded bg-zinc-100" />
        <div class="h-4 w-28 rounded bg-zinc-100" />
        <div class="flex gap-1.5">
          <div class="h-6 w-16 rounded-full bg-zinc-100" />
          <div class="h-6 w-14 rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  </div>
</template>
