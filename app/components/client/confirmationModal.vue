<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click.self="emit('cancel')"
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
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            @click="emit('cancel')"
          >
            {{ cancelText ?? 'Cancel' }}
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            ]"
            @click="emit('confirm')"
          >
            {{ confirmText ?? 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
