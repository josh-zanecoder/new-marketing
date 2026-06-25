<script setup lang="ts">
import type { AppToastVariant } from '~/composables/useAppToast'

const { toasts, dismiss } = useAppToast()

function toastClass(variant: AppToastVariant): string {
  if (variant === 'success') {
    return 'border-emerald-200/90 bg-emerald-50 text-emerald-950 shadow-emerald-900/10'
  }
  if (variant === 'error') {
    return 'border-red-200/90 bg-red-50 text-red-950 shadow-red-900/10'
  }
  return 'border-slate-200/90 bg-white text-slate-900 shadow-slate-900/10'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg"
          :class="toastClass(toast.variant)"
          role="status"
        >
          <p class="min-w-0 flex-1 leading-snug">
            {{ toast.message }}
          </p>
          <button
            type="button"
            class="shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-semibold opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
