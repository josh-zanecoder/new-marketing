<script setup lang="ts">
import {
  DIGIKARD_SAMPLE_CARD,
  DIGIKARD_TEMPLATE_IDS,
  type DigikardTemplateId
} from '~~/shared/digikardTemplates'

defineProps<{
  templateId: DigikardTemplateId
}>()

const card = DIGIKARD_SAMPLE_CARD
const initial = card.name.charAt(0)
</script>

<template>
  <!-- Classic — light teal -->
  <div
    v-if="templateId === DIGIKARD_TEMPLATE_IDS.CLASSIC"
    class="min-h-full bg-gradient-to-br from-stone-50 via-white to-amber-50/30 p-6"
  >
    <div class="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-xl shadow-stone-200/60">
      <div class="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-transparent" />
      <div class="relative px-8 pb-8 pt-10 text-center">
        <div class="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-teal-400 to-cyan-500 text-3xl font-bold text-white shadow-lg shadow-teal-500/25">
          {{ initial }}
        </div>
        <h3 class="text-2xl font-bold tracking-tight text-stone-900">{{ card.name }}</h3>
        <p class="mt-1 text-base font-medium text-stone-600">{{ card.title }}</p>
        <p class="mt-2 text-sm text-stone-500">{{ card.city }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <span class="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700">{{ card.email }}</span>
          <span class="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700">{{ card.phone }}</span>
        </div>
        <button
          type="button"
          class="mt-6 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20"
        >
          Book me
        </button>
      </div>
    </div>
  </div>

  <!-- Premium — dark gradient -->
  <div
    v-else-if="templateId === DIGIKARD_TEMPLATE_IDS.PREMIUM"
    class="min-h-full bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6"
  >
    <div class="relative mx-auto max-w-md overflow-hidden rounded-3xl bg-gradient-to-r from-black via-gray-900 to-black px-6 py-12 text-center shadow-2xl">
      <div class="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-r from-[#3DDAB3] to-[#2BC9A0] p-1.5">
        <span class="flex h-full w-full items-center justify-center rounded-full bg-gray-900 text-3xl font-bold text-white">{{ initial }}</span>
      </div>
      <h3 class="text-3xl font-extrabold tracking-tight text-white">{{ card.name }}</h3>
      <p class="mt-2 text-lg font-light text-gray-300">{{ card.title }}</p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <span class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur-sm">{{ card.email }}</span>
        <span class="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur-sm">{{ card.phone }}</span>
      </div>
      <button
        type="button"
        class="mt-8 rounded-full bg-[#3DDAB3] px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
      >
        Book me
      </button>
    </div>
  </div>

  <!-- Aura — dark glass / amber -->
  <div
    v-else-if="templateId === DIGIKARD_TEMPLATE_IDS.AURA"
    class="min-h-full bg-[#0a0a0b] p-6"
  >
    <div class="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center shadow-2xl backdrop-blur">
      <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div class="relative">
        <div class="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-transparent text-3xl font-bold text-amber-100">
          {{ initial }}
        </div>
        <h3 class="text-3xl font-semibold tracking-tight text-white">{{ card.name }}</h3>
        <p class="mt-2 text-amber-200/80">{{ card.title }}</p>
        <p class="mt-2 text-sm text-white/40">{{ card.city }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <span class="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80">{{ card.email }}</span>
          <span class="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80">{{ card.phone }}</span>
        </div>
        <button
          type="button"
          class="mt-8 rounded-full border border-amber-400/50 bg-amber-500/20 px-6 py-2.5 text-sm font-semibold text-amber-100"
        >
          Book me
        </button>
      </div>
    </div>
  </div>

  <!-- Reef — teal dark minimal -->
  <div
    v-else-if="templateId === DIGIKARD_TEMPLATE_IDS.REEF"
    class="min-h-full bg-[#04141a] p-6"
  >
    <div class="mx-auto max-w-md rounded-2xl border border-teal-500/20 bg-[#072029] px-6 py-12 text-center shadow-xl">
      <div class="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-teal-500/15 text-3xl font-bold text-teal-300 ring-1 ring-teal-400/30">
        {{ initial }}
      </div>
      <h3 class="text-2xl font-bold tracking-tight text-white">{{ card.name }}</h3>
      <p class="mt-2 text-sm uppercase tracking-[0.2em] text-teal-300/80">{{ card.title }}</p>
      <div class="mx-auto mt-6 h-px w-16 bg-teal-400/40" />
      <div class="mt-6 space-y-2 text-sm text-teal-100/70">
        <p>{{ card.email }}</p>
        <p>{{ card.phone }}</p>
        <p>{{ card.city }}</p>
      </div>
      <button
        type="button"
        class="mt-8 rounded-md bg-teal-500 px-6 py-2.5 text-sm font-semibold text-[#04141a]"
      >
        Book me
      </button>
    </div>
  </div>

  <!-- Lévu — retro 70s -->
  <div
    v-else
    class="min-h-full p-6"
    style="background:
      repeating-conic-gradient(#5C3A2E 0% 25%, #EDD9CF 0% 50%) 0 0 / 28px 28px"
  >
    <div class="mx-auto max-w-md overflow-hidden rounded-[1.75rem] border-[3px] border-[#5C3A2E] bg-[#FAF0EB] shadow-[4px_4px_0_#5C3A2E]">
      <div class="px-6 py-10 text-center font-serif">
        <div class="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-[#5C3A2E] bg-[#EDD9CF] text-3xl font-bold text-[#5C3A2E]">
          {{ initial }}
        </div>
        <h3 class="text-3xl font-bold text-[#5C3A2E]">{{ card.name }}</h3>
        <p class="mt-2 text-lg text-[#5C3A2E]/80">{{ card.title }}</p>
        <p class="mt-1 text-sm text-[#5C3A2E]/60">{{ card.city }}</p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <span class="rounded-full border-2 border-[#5C3A2E] bg-white px-3 py-1 text-xs font-semibold text-[#5C3A2E]">{{ card.email }}</span>
          <span class="rounded-full border-2 border-[#5C3A2E] bg-white px-3 py-1 text-xs font-semibold text-[#5C3A2E]">{{ card.phone }}</span>
        </div>
        <button
          type="button"
          class="mt-8 rounded-full border-2 border-[#5C3A2E] bg-[#5C3A2E] px-6 py-2.5 text-sm font-semibold text-[#EDD9CF]"
        >
          Book me
        </button>
      </div>
    </div>
  </div>
</template>
