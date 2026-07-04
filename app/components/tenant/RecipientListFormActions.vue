<script setup lang="ts">
const props = defineProps<{
  reasons: readonly string[]
  hintHeading: string
  submitLabel: string
  cancelTo: string
  canSubmit: boolean
  saving: boolean
  /** Edit layout: cancel above save on mobile; DOM order cancel → save for desktop. */
  cancelFirstOnMobile?: boolean
}>()

const submitHintRef = ref<{ emphasize: () => void } | null>(null)

const hintVisible = computed(
  () => !props.saving && !props.canSubmit && props.reasons.length > 0
)

const submitDisabled = computed(() => props.saving || !props.canSubmit)

const actionsClass = computed(() =>
  props.cancelFirstOnMobile
    ? 'flex w-full flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:justify-end sm:gap-4 sm:pt-2'
    : 'flex w-full flex-col items-stretch gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3 sm:pt-2'
)

const cancelClass =
  'inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition-colors hover:border-primary-200 hover:bg-primary-50/80 hover:text-primary-800 sm:w-auto sm:text-[15px]'

const submitClass =
  'inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 sm:px-8 sm:text-[15px]'

function onSubmitAreaClick(event: MouseEvent) {
  if (!submitDisabled.value) return
  event.preventDefault()
  submitHintRef.value?.emphasize()
}
</script>

<template>
  <div class="w-full">
    <TenantRecipientListSubmitHint
      ref="submitHintRef"
      :visible="hintVisible"
      :reasons="reasons"
      :heading="hintHeading"
    />

    <!-- Edit: cancel before save in DOM → save on the right at sm+ -->
    <div v-if="cancelFirstOnMobile" :class="actionsClass">
      <NuxtLink
        :to="cancelTo"
        :class="[cancelClass, { 'pointer-events-none opacity-50': saving }]"
      >
        Cancel
      </NuxtLink>
      <div class="w-full sm:w-auto" @click="onSubmitAreaClick">
        <button
          type="submit"
          :class="[submitClass, { 'pointer-events-none': submitDisabled }]"
          :disabled="submitDisabled"
        >
          {{ saving ? 'Saving…' : submitLabel }}
        </button>
      </div>
    </div>

    <!-- Create: save before cancel in DOM; reorder at sm+ so save stays on the right -->
    <div v-else :class="actionsClass">
      <div class="w-full sm:order-2 sm:w-auto" @click="onSubmitAreaClick">
        <button
          type="submit"
          :class="[submitClass, { 'pointer-events-none': submitDisabled }]"
          :disabled="submitDisabled"
        >
          {{ saving ? 'Saving…' : submitLabel }}
        </button>
      </div>
      <NuxtLink
        :to="cancelTo"
        :class="[cancelClass, 'sm:order-1', { 'pointer-events-none opacity-50': saving }]"
      >
        Cancel
      </NuxtLink>
    </div>
  </div>
</template>
