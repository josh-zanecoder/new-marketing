<script setup lang="ts">
/**
 * Spike only — embeds Lit Pigeon (web component) for side-by-side comparison.
 * Not wired to save/campaigns yet.
 */
const STORAGE_KEY = 'marketing-editor-compare-lit-pigeon'

const status = ref('Loading Lit Pigeon…')
const error = ref('')
const lastSavedAt = ref('')
const ready = ref(false)

onMounted(async () => {
  try {
    await import('@lit-pigeon/editor')
    ready.value = true
    status.value = 'Lit Pigeon ready — drag blocks from the palette. Draft autosaves in this browser.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start Lit Pigeon.'
    status.value = ''
  }
})

function onReady(event: Event) {
  const el = event.target as HTMLElement & { document?: unknown }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && el && 'document' in el) {
      el.document = JSON.parse(raw)
    }
  } catch {
    /* keep starter doc */
  }
}

function onChange(event: Event) {
  const detail = (event as CustomEvent<{ document?: unknown }>).detail
  if (!detail?.document) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail.document))
  lastSavedAt.value = new Date().toLocaleTimeString()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <p class="min-w-0 truncate">{{ error || status }}</p>
      <p v-if="lastSavedAt" class="shrink-0 text-slate-400">Draft {{ lastSavedAt }}</p>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden bg-white">
      <pigeon-editor
        v-if="ready"
        class="block h-full w-full"
        style="min-height: 520px; height: 100%"
        theme="light"
        @pigeon:ready="onReady"
        @pigeon:change="onChange"
      />
      <p v-else-if="!error" class="p-4 text-sm text-slate-500">Starting editor…</p>
    </div>
  </div>
</template>
