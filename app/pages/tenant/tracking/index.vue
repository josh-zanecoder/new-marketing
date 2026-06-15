<template>
  <div class="w-full min-w-0">
    <header class="mb-8 sm:mb-10">
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Tracking
        </h1>
        <p class="max-w-xl text-sm text-zinc-500 sm:text-[15px]">
          Brevo delivery, opens, clicks, and engagement reporting across this workspace.
        </p>
      </div>
    </header>

    <section class="mb-10" aria-label="Brevo analytics overview">
      <TenantCampaignTrackingAnalytics />
    </section>

    <TenantTrackingEventsPanel
      panel-hint="Browse individual Brevo webhook events grouped by message."
    />
  </div>
</template>
