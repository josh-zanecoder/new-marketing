<script setup lang="ts">
defineProps<{
  hasFlyersOutsideFilter: boolean
  canAddFlyers: boolean
  categoriesManagePath: string
}>()
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/[0.04] ring-1 ring-zinc-900/[0.02]"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.07),_transparent_55%),linear-gradient(to_bottom,_rgb(250,250,250),_white)]"
      aria-hidden="true"
    />

    <div class="relative flex flex-col items-center px-5 py-8 text-center sm:px-6 sm:py-10">
      <!-- Compact stacked preview -->
      <div class="relative mb-5 h-20 w-32" aria-hidden="true">
        <div
          class="absolute left-0 top-2.5 h-14 w-[4.5rem] -rotate-6 rounded-lg border border-zinc-200/90 bg-white shadow-sm"
        >
          <div class="m-1.5 h-5 rounded bg-zinc-100" />
          <div class="mx-1.5 mt-1 h-1 w-3/4 rounded bg-zinc-100" />
        </div>
        <div
          class="absolute right-0 top-2 h-14 w-[4.5rem] rotate-6 rounded-lg border border-zinc-200/90 bg-white shadow-sm"
        >
          <div class="m-1.5 flex h-5 items-center justify-center rounded bg-primary-50 text-[9px] font-bold uppercase tracking-wider text-primary-600">
            PDF
          </div>
          <div class="mx-1.5 mt-1 h-1 w-2/3 rounded bg-zinc-100" />
        </div>
        <div
          class="absolute left-1/2 top-0 z-10 h-16 w-20 -translate-x-1/2 rounded-lg border border-primary-200/80 bg-gradient-to-b from-white to-primary-50/40 shadow-md shadow-primary-600/10"
        >
          <div class="m-2 flex h-7 items-center justify-center rounded-md bg-primary-600/90 text-white">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.75"
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
          </div>
          <div class="mx-2 mt-1.5 h-1 w-4/5 rounded bg-primary-100" />
          <div class="mx-2 mt-1 h-1 w-1/2 rounded bg-primary-100/80" />
        </div>
      </div>

      <h3 class="text-lg font-semibold tracking-tight text-zinc-900">
        {{ hasFlyersOutsideFilter ? 'Nothing in this category' : 'Build your flyer library' }}
      </h3>
      <p class="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        <template v-if="hasFlyersOutsideFilter">
          Switch the filter to
          <span class="font-semibold text-zinc-700">All categories</span>
          or pick another group.
        </template>
        <template v-else-if="canAddFlyers">
          Upload printable PDFs or images with
          <span class="font-semibold text-zinc-800">Add flyer</span>
          — grouped by your Template categories.
        </template>
        <template v-else>
          Browse only. Ask a superadmin for
          <code class="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-700">marketing:flyers:add</code>.
        </template>
      </p>

      <ol
        v-if="!hasFlyersOutsideFilter && canAddFlyers"
        class="mt-5 grid w-full max-w-xl gap-2.5 text-left sm:grid-cols-3"
      >
        <li class="rounded-lg border border-zinc-200/80 bg-white/90 px-3 py-2.5">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-primary-600">1 · Name</p>
          <p class="mt-0.5 text-xs text-zinc-500">Clear title for your team</p>
        </li>
        <li class="rounded-lg border border-zinc-200/80 bg-white/90 px-3 py-2.5">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-primary-600">2 · Category</p>
          <p class="mt-0.5 text-xs text-zinc-500">Reuse Template groups</p>
        </li>
        <li class="rounded-lg border border-zinc-200/80 bg-white/90 px-3 py-2.5">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-primary-600">3 · Upload</p>
          <p class="mt-0.5 text-xs text-zinc-500">PDF / image · print anytime</p>
        </li>
      </ol>

      <div
        v-if="!hasFlyersOutsideFilter && canAddFlyers"
        class="mt-4 flex flex-wrap items-center justify-center gap-1.5"
      >
        <span class="rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/90">
          PDF
        </span>
        <span class="rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/90">
          PNG · JPEG · WebP
        </span>
        <span class="rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-200/90">
          Up to 15MB
        </span>
      </div>

      <NuxtLink
        :to="categoriesManagePath"
        class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
      >
        Manage categories
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>
    </div>
  </div>
</template>
