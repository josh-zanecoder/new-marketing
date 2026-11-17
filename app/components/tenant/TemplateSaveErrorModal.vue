<script setup lang="ts">
import { TEMPLATE_SAVE_ERROR_CONFIRM } from '~~/shared/constants/templateSaveError'
import { resolveTemplateSaveErrorPresentation } from '~~/shared/utils/resolveTemplateSaveErrorPresentation'

const props = defineProps<{
  open: boolean
  /** Raw save failure from the page (mapped to friendly copy). */
  message: string
  confirmText?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const presentation = computed(() => resolveTemplateSaveErrorPresentation(props.message))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-save-error-title"
      @click.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/70">
        <div class="border-b border-slate-100 px-6 pb-4 pt-6">
          <div class="flex items-start gap-3">
            <div
              class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100"
              aria-hidden="true"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <h3
                id="template-save-error-title"
                class="text-lg font-semibold tracking-tight text-slate-900"
              >
                {{ presentation.title }}
              </h3>
              <p class="mt-1.5 text-sm leading-relaxed text-slate-600">
                {{ presentation.body }}
              </p>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm leading-relaxed text-slate-500">
            {{ presentation.hint }}
          </p>
        </div>

        <div class="flex justify-end border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            @click="emit('close')"
          >
            {{ confirmText || TEMPLATE_SAVE_ERROR_CONFIRM }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
