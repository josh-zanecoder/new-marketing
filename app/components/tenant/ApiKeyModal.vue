<template>
  <Teleport to="body">
    <div
      v-if="props.open && props.apiKey"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              {{ props.title }}
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              Copy this key now. It will not be shown again.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            @click="emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <code class="flex-1 truncate font-mono text-sm text-slate-800 select-all">
            {{ props.apiKey }}
          </code>
          <button
            type="button"
            class="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            @click="copyToClipboard"
          >
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <p class="mt-3 text-xs text-slate-500">
          Use in requests: <code class="rounded bg-slate-100 px-1">x-client-key: YOUR_KEY</code> (tenant API key)
          or <code class="rounded bg-slate-100 px-1">Authorization: Bearer YOUR_KEY</code>
        </p>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            @click="emit('close')"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  apiKey: string
  title?: string
}>()

const emit = defineEmits<{ close: [] }>()

const copied = ref(false)

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(props.apiKey)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    const input = document.createElement('input')
    input.value = props.apiKey
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>
