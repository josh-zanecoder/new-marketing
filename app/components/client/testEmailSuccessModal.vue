<script setup lang="ts">
const props = defineProps<{
  open: boolean
  recipient: string
}>()

const emit = defineEmits<{
  close: []
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
        class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-email-success-title"
        @click.self="emit('close')"
      >
        <div
          class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60"
        >
          <div class="flex flex-col items-center text-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 id="test-email-success-title" class="mt-4 text-lg font-semibold text-slate-900">
              Test email sent
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              Your test email was sent to
              <span class="font-medium text-slate-900">{{ props.recipient }}</span>.
              Check your inbox and spam folder if it does not arrive within a few minutes.
            </p>
            <button
              type="button"
              class="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              @click="emit('close')"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
