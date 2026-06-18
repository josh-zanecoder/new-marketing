<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header>
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Insights
        </p>
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          Marketing Analytics
        </h1>
        <p class="max-w-2xl text-sm text-zinc-500 sm:text-[15px]">
          Campaign performance from Brevo delivery and engagement events—volume, delivery, opens, clicks, bounces, and unsubscribes.
        </p>
      </div>
    </header>

    <TenantMarketingAnalyticsPanel />
  </div>
</template>
