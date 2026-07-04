<script setup lang="ts">
const legendCount = 3
</script>

<template>
  <div
    class="flex h-56 animate-pulse flex-col sm:h-72"
    aria-hidden="true"
  >
    <div class="relative min-h-0 flex-1">
      <div class="absolute inset-0 flex">
        <div class="flex w-7 shrink-0 flex-col justify-between pb-7 pt-1 sm:w-8">
          <div v-for="n in 2" :key="`y-${n}`" class="h-2.5 w-2 rounded bg-zinc-100" />
        </div>

        <div class="relative min-w-0 flex-1 pb-7">
          <div class="absolute inset-x-0 top-1/2 border-t border-zinc-100" />

          <svg
            class="pointer-events-none absolute inset-0 h-full w-full text-zinc-200"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="0"
              stroke="currentColor"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <div
            class="absolute right-0 top-0 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-zinc-200"
          />

          <div class="absolute inset-x-0 bottom-0 flex justify-between">
            <div v-for="n in 2" :key="`x-${n}`" class="h-2.5 w-8 rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
      <div v-for="n in legendCount" :key="`legend-${n}`" class="flex items-center gap-1.5">
        <div class="h-2 w-2 rounded-full bg-zinc-100" />
        <div class="h-2 w-14 rounded bg-zinc-100" />
      </div>
    </div>
  </div>
</template>
