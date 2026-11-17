<script setup lang="ts">
import { resolveTemplateSaveErrorPresentation } from '~~/shared/utils/resolveTemplateSaveErrorPresentation'

const props = defineProps<{
  open: boolean
  title: string
  message: string
  stayText: string
  discardText: string
  saveText: string
  busy?: boolean
  /** Shown when Save fails (missing name/subject, API error, etc.). */
  error?: string
}>()

const emit = defineEmits<{
  stay: []
  discard: []
  save: []
}>()

const saveErrorView = computed(() =>
  props.error ? resolveTemplateSaveErrorPresentation(props.error) : null
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-template-changes-title"
      @click.self="busy ? undefined : emit('stay')"
      @keydown.esc="busy ? undefined : emit('stay')"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <h3
          id="unsaved-template-changes-title"
          class="text-lg font-semibold text-slate-900"
        >
          {{ title }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-600">
          {{ message }}
        </p>
        <div
          v-if="saveErrorView"
          class="mt-4 rounded-xl border border-amber-100 bg-amber-50/80 px-3.5 py-3"
          role="alert"
        >
          <p class="text-sm font-medium text-amber-950">{{ saveErrorView.title }}</p>
          <p class="mt-1 text-sm leading-relaxed text-amber-900/80">{{ saveErrorView.body }}</p>
          <p class="mt-1.5 text-xs leading-relaxed text-amber-800/70">{{ saveErrorView.hint }}</p>
        </div>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy"
            @click="emit('stay')"
          >
            {{ stayText }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="busy"
            @click="emit('discard')"
          >
            {{ discardText }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="busy"
            @click="emit('save')"
          >
            <svg
              v-if="busy"
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
            {{ busy ? 'Saving…' : saveText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
