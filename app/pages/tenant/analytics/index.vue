<script setup lang="ts">
import type TenantMarketingAnalyticsPanel from '~/components/tenant/MarketingAnalyticsPanel.vue'

definePageMeta({ layout: 'default' })

const analyticsPanelRef = ref<InstanceType<typeof TenantMarketingAnalyticsPanel> | null>(null)
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">
          Insights
        </p>
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          Marketing Analytics
        </h1>
        <p class="max-w-2xl text-sm text-zinc-500 sm:text-[15px]">
          Campaign performance from Brevo delivery and engagement events—volume, delivery, opens, clicks, bounces, and unsubscribes.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh marketing analytics"
        :pending="analyticsPanelRef?.pending"
        @click="() => analyticsPanelRef?.refresh?.()"
      />
    </header>

    <TenantMarketingAnalyticsPanel ref="analyticsPanelRef" />
  </div>
</template>
