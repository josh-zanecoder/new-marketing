<script setup lang="ts">
import type TenantBrevoTrackingEventsPanel from '~/components/tenant/BrevoTrackingEventsPanel.vue'

definePageMeta({ layout: 'default' })

const trackingPanelRef = ref<InstanceType<typeof TenantBrevoTrackingEventsPanel> | null>(null)

const trackingPending = computed(
  () => unref(trackingPanelRef.value?.pending as boolean | Ref<boolean> | undefined) ?? false
)

function onRefreshTracking() {
  void trackingPanelRef.value?.refresh?.()
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl">
    <header class="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Delivery</p>
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          Tracking
        </h1>
        <p class="max-w-2xl text-sm text-zinc-500 sm:text-[15px]">
          Delivery, opens, and clicks from your sends—stored in this workspace. Click Refresh to pull the latest.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh tracking"
        :pending="trackingPending"
        @click="onRefreshTracking"
      />
    </header>
    <TenantBrevoTrackingEventsPanel ref="trackingPanelRef" />
  </div>
</template>
