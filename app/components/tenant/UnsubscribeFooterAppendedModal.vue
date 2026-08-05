<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmText: string
  previewText: string
}>()

const emit = defineEmits<{
  close: []
  preview: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsubscribe-footer-appended-title"
        @click.self="emit('close')"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
          <div class="flex flex-col items-center text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"
            >
              <svg
                class="h-7 w-7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                />
              </svg>
            </div>
            <h3
              id="unsubscribe-footer-appended-title"
              class="mt-4 text-lg font-semibold text-slate-900"
            >
              {{ props.title }}
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              {{ props.message }}
            </p>
            <div class="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
                @click="emit('preview')"
              >
                {{ props.previewText }}
              </button>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                @click="emit('close')"
              >
                {{ props.confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
