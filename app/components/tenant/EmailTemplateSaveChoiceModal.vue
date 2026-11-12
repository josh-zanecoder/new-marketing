<script setup lang="ts">
const props = defineProps<{
  open: boolean
  templateName: string
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  replace: []
  copy: [name: string]
}>()

const copyName = ref('')
const copyNameError = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  const base = props.templateName.trim() || 'Template'
  copyName.value = /\(copy\)\s*$/i.test(base) ? base : `${base} (copy)`
  copyNameError.value = ''
})

function submitCopy() {
  const name = copyName.value.trim()
  if (!name) {
    copyNameError.value = 'Give the copy a name.'
    return
  }
  copyNameError.value = ''
  emit('copy', name)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-template-choice-title"
      @click.self="saving ? undefined : emit('close')"
      @keydown.esc="saving ? undefined : emit('close')"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <h3 id="save-template-choice-title" class="text-lg font-semibold text-slate-900">
          Save this template?
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-600">
          <span class="font-medium text-slate-800">{{ templateName || 'This template' }}</span>
          is already saved. Replace that original, or keep it and save a copy.
        </p>
        <p v-if="error" class="mt-3 text-sm text-red-600" role="alert">{{ error }}</p>
        <div class="mt-5">
          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            :disabled="saving"
            @click="emit('replace')"
          >
            {{ saving ? 'Saving…' : 'Replace original' }}
          </button>
        </div>
        <div class="mt-4 rounded-xl border border-slate-200 p-3">
          <label class="block text-sm font-medium text-slate-700" for="template-copy-name">Copy name</label>
          <input
            id="template-copy-name"
            v-model="copyName"
            type="text"
            maxlength="200"
            class="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            :disabled="saving"
          >
          <p v-if="copyNameError" class="mt-1 text-xs text-red-600">{{ copyNameError }}</p>
          <button
            type="button"
            class="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            :disabled="saving"
            @click="submitCopy"
          >
            Save a copy
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            :disabled="saving"
            @click="emit('close')"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
