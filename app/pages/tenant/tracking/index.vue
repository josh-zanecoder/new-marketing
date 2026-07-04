<script setup lang="ts">
definePageMeta({ layout: 'default' })

await useBrevoTrackingReport()
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-6xl">
    <header class="mb-6 sm:mb-8">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary-600">Delivery</p>
        <h1 class="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          Tracking
        </h1>
        <p class="max-w-2xl text-sm text-zinc-500 sm:text-[15px]">
          Delivery, opens, and clicks from your sends—filtered to this workspace. Data comes from Brevo and is grouped by message.
        </p>
      </div>
    </header>
    <TenantBrevoTrackingEventsPanel />
  </div>
</template>
