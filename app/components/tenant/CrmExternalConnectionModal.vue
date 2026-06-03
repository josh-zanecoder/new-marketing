<template>
  <Teleport to="body">
    <div
      v-if="props.open && props.metadata"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">
              {{ props.title }}
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              {{ helperText }}
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

        <div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div class="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              @click="handleCopy"
            >
              {{ copied ? 'Copied' : 'Copy JSON' }}
            </button>
          </div>
          <pre class="max-h-[min(24rem,50vh)] overflow-auto p-4 text-xs leading-relaxed text-slate-800"><code>{{ jsonText }}</code></pre>
        </div>

        <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            v-if="props.dbName"
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="props.regenerating"
            @click="emit('regenerate')"
          >
            <span
              v-if="props.regenerating"
              class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"
              aria-hidden="true"
            />
            {{ props.regenerating ? 'Regenerating API key…' : 'Regenerate API key' }}
          </button>
          <div v-else class="hidden sm:block" />
          <button
            type="button"
            class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors sm:ml-auto"
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
import type { CrmExternalConnectionMetadata } from '~~/shared/types/crmExternalConnection'
import { useCrmExternalConnectionDisplay } from '~/composables/admin/tenants/useCrmExternalConnectionDisplay'
import { useClipboardCopy } from '~/composables/useClipboardCopy'

const props = withDefaults(defineProps<{
  open: boolean
  metadata: CrmExternalConnectionMetadata | null
  title?: string
  dbName?: string | null
  mode?: 'create' | 'regenerate'
  regenerating?: boolean
}>(), {
  title: 'CRM external connection metadata',
  dbName: null,
  mode: 'create',
  regenerating: false
})

const emit = defineEmits<{ close: []; regenerate: [] }>()

const helperText = computed(() => {
  if (props.mode === 'regenerate') {
    return 'Only the API key was regenerated. Copy the full JSON and update CRM external connection metadata.'
  }
  return 'Copy this JSON now and paste it into CRM external connection metadata. It includes the API key and will not be shown again. Use Regenerate API key if you need a new key.'
})

const metadataRef = toRef(props, 'metadata')
const { jsonText } = useCrmExternalConnectionDisplay(metadataRef)
const { copied, copyText } = useClipboardCopy()

async function handleCopy() {
  if (!jsonText.value) return
  await copyText(jsonText.value)
}
</script>
