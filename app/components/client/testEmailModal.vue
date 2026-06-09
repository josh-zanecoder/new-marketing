<script setup lang="ts">
const props = defineProps<{
  open: boolean
  recipient: string
  sending: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:recipient': [value: string]
  send: []
  close: []
}>()

function onBackdropClick() {
  if (props.sending) return
  emit('close')
}

function onRecipientInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:recipient', target.value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-email-title"
      :aria-busy="sending"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-hidden="true"
        @click="onBackdropClick"
      />
      <div
        class="relative w-full max-w-md rounded-t-2xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.04] sm:rounded-2xl sm:p-6"
      >
        <h2 id="test-email-title" class="text-lg font-semibold text-slate-900">
          Send test email
        </h2>
        <p class="mt-1 text-sm text-slate-500">
          Sends one email with merge tags applied. Does not change campaign status or recipients.
        </p>
        <label class="mt-4 block text-sm font-medium text-slate-700" for="test-email-recipient">
          Recipient email
        </label>
        <input
          id="test-email-recipient"
          :value="recipient"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          class="mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] focus:border-indigo-300 focus:outline-none focus:ring-[3px] focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          :disabled="sending"
          @input="onRecipientInput"
        >
        <p v-if="error" class="mt-3 text-sm text-red-600" role="alert">
          {{ error }}
        </p>
        <div
          v-if="sending"
          class="mt-4 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900"
          role="status"
          aria-live="polite"
        >
          <svg
            class="h-5 w-5 shrink-0 animate-spin text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Sending test email…</span>
        </div>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="sending"
            @click="onBackdropClick"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="sending"
            @click="emit('send')"
          >
            <svg
              v-if="sending"
              class="h-4 w-4 shrink-0 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {{ sending ? 'Sending…' : 'Send test' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
