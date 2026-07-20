<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default' | 'primary'
  /** When true, actions are disabled and confirm shows a working state (e.g. before redirect). */
  confirmLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const slots = useSlots()

function onBackdropClick() {
  if (props.confirmLoading) return
  emit('cancel')
}

const cancelButtonClass =
  'inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50'

const confirmButtonClass = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60'
  if (props.variant === 'danger') {
    return `${base} rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700`
  }
  if (props.variant === 'primary') {
    return `${base} btn-modal-submit`
  }
  return `${base} rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800`
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="onBackdropClick"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200/60">
        <h3 class="text-lg font-semibold text-slate-900">
          {{ title }}
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          {{ message }}
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            :class="[
              cancelButtonClass,
              variant === 'primary'
                ? 'btn-modal-cancel'
                : 'rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50'
            ]"
            :disabled="confirmLoading"
            @click="onBackdropClick"
          >
            {{ cancelText ?? 'Cancel' }}
          </button>
          <button
            type="button"
            :disabled="confirmLoading"
            :class="confirmButtonClass"
            @click="emit('confirm')"
          >
            <svg
              v-if="confirmLoading"
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
            <span v-else-if="slots['confirm-icon']" class="inline-flex shrink-0">
              <slot name="confirm-icon" />
            </span>
            {{ confirmLoading ? 'Please wait…' : (confirmText ?? 'Confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
