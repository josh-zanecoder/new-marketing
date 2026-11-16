<script setup lang="ts">
import LitPigeonSpike from '~/components/tenant/editorCompare/LitPigeonSpike.vue'
import TemplaticalSpike from '~/components/tenant/editorCompare/TemplaticalSpike.vue'

definePageMeta({ layout: 'default' })

type CompareTab = 'templatical' | 'lit-pigeon' | 'ours'

const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)
const tab = ref<CompareTab>('templatical')

const tabs: { id: CompareTab; label: string; blurb: string }[] = [
  {
    id: 'templatical',
    label: 'Templatical',
    blurb: 'Vue-friendly, MJML export, free for commercial use (FSL → MIT).'
  },
  {
    id: 'lit-pigeon',
    label: 'Lit Pigeon',
    blurb: 'MIT web component, email-first, works in Vue via custom element.'
  },
  {
    id: 'ours',
    label: 'Ours + Grapes / Beefree',
    blurb: 'Jump to builders already in Marketing.'
  }
]
</script>

<template>
  <div
    class="fixed inset-y-0 right-0 z-30 flex min-h-0 flex-col overflow-hidden bg-slate-100"
    :class="sidebarCompact ? 'left-16' : 'left-0 lg:left-72'"
  >
    <header class="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold text-slate-900">Email editor compare</h1>
          <p class="mt-0.5 text-xs text-slate-500">
            Spike only — try free builders side by side. Drafts stay in this browser; nothing saves to campaigns yet.
          </p>
        </div>
        <span class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
          Comparison spike
        </span>
      </div>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
          :class="tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </div>
      <p class="mt-2 text-[11px] text-slate-500">
        {{ tabs.find((item) => item.id === tab)?.blurb }}
      </p>
    </header>

    <div class="min-h-0 flex-1 overflow-hidden">
      <ClientOnly>
        <TemplaticalSpike v-if="tab === 'templatical'" class="h-full" />
        <LitPigeonSpike v-else-if="tab === 'lit-pigeon'" class="h-full" />
        <div v-else class="h-full overflow-auto p-4">
          <div class="mx-auto grid max-w-3xl gap-3">
            <NuxtLink
              to="/tenant/templatical-builder"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <p class="text-sm font-semibold text-slate-900">Templatical builder</p>
              <p class="mt-1 text-xs text-slate-500">
                Create + open existing templates, merge tags, image upload — recommended DnD path.
              </p>
            </NuxtLink>
            <NuxtLink
              to="/tenant/template-builder"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <p class="text-sm font-semibold text-slate-900">Template builder</p>
              <p class="mt-1 text-xs text-slate-500">
                Our in-house section/image builder (the one you’ve been QA’ing).
              </p>
            </NuxtLink>
            <NuxtLink
              to="/tenant/email-editor"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <p class="text-sm font-semibold text-slate-900">Email editor (GrapesJS)</p>
              <p class="mt-1 text-xs text-slate-500">
                Open-source GrapesJS newsletter preset already in the app.
              </p>
            </NuxtLink>
            <NuxtLink
              to="/tenant/email-builder"
              class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <p class="text-sm font-semibold text-slate-900">Email builder (Beefree)</p>
              <p class="mt-1 text-xs text-slate-500">
                Hosted Beefree SDK — polished, but freemium / vendor-hosted.
              </p>
            </NuxtLink>
          </div>
        </div>
        <template #fallback>
          <p class="p-4 text-sm text-slate-500">Loading editors…</p>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
