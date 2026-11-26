<script setup lang="ts">
/**
 * Step 1 of the recipients flow: how the audience is chosen.
 * Only rendered for tenants with Advanced Recipient Filtering; others keep the original two-option picker.
 */
type RecipientMethod = 'list' | 'manual' | 'filters'

const props = defineProps<{
  /** `null` until the user has picked a method. */
  modelValue: RecipientMethod | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RecipientMethod]
}>()

const options: Array<{
  value: RecipientMethod
  title: string
  icon: string
}> = [
  {
    value: 'list',
    title: 'Use a list',
    icon: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'
  },
  {
    value: 'manual',
    title: 'Pick contacts',
    icon: 'M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z'
  },
  {
    value: 'filters',
    title: 'Filter contacts',
    icon: 'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z'
  }
]
</script>

<template>
  <div class="space-y-3">
    <TenantCampaignRecipientStepHeading
      :step="1"
      title="Choose recipients"
      :done="props.modelValue !== null"
    />
    <div
      class="grid gap-3 sm:grid-cols-3"
      role="radiogroup"
      aria-label="How do you want to choose recipients?"
    >
      <button
        v-for="o in options"
        :id="`campaign-recipients-method-${o.value}`"
        :key="o.value"
        type="button"
        role="radio"
        :aria-checked="props.modelValue === o.value"
        :class="[
          'flex flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left transition-colors sm:px-5 sm:py-4',
          props.modelValue === o.value
            ? 'border-primary-300 bg-primary-50/60 shadow-sm ring-1 ring-primary-200/60'
            : 'border-slate-200 bg-white/70 hover:border-primary-200 hover:bg-white'
        ]"
        @click="emit('update:modelValue', o.value)"
      >
        <span
          :class="[
            'flex h-9 w-9 items-center justify-center rounded-lg',
            props.modelValue === o.value ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
          ]"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              :d="o.icon"
            />
          </svg>
        </span>
        <span class="text-sm font-semibold text-slate-900 sm:text-[15px]">{{ o.title }}</span>
      </button>
    </div>
  </div>
</template>
