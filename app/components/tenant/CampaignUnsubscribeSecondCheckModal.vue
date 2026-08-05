<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  message: string
  approveText: string
  declineText: string
  previewText: string
  approveHint: string
  declineHint: string
  approving?: boolean
}>()

const emit = defineEmits<{
  approve: []
  decline: []
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
        aria-labelledby="campaign-unsubscribe-second-check-title"
        @click.self="!props.approving && emit('decline')"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
          <div class="flex flex-col items-center text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700"
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
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h3
              id="campaign-unsubscribe-second-check-title"
              class="mt-4 text-lg font-semibold text-slate-900"
            >
              {{ props.title }}
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              {{ props.message }}
            </p>
            <button
              type="button"
              class="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              :disabled="props.approving"
              @click="emit('preview')"
            >
              {{ props.previewText }}
            </button>
            <div class="mt-3 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="inline-flex w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                :disabled="props.approving"
                @click="emit('decline')"
              >
                <span>{{ props.declineText }}</span>
                <span class="mt-0.5 text-xs font-normal text-red-500">{{ props.declineHint }}</span>
              </button>
              <button
                type="button"
                class="inline-flex w-full flex-col items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                :disabled="props.approving"
                @click="emit('approve')"
              >
                <span>{{ props.approving ? 'Starting…' : props.approveText }}</span>
                <span class="mt-0.5 text-xs font-normal text-emerald-100">{{ props.approveHint }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
