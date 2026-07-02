<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <header class="space-y-1">
      <p class="page-eyebrow">Admin</p>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-lead">Quick overview of your activity</p>
    </header>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article class="stat-tile">
        <span class="text-sm font-medium text-slate-500">Total tenants</span>
        <strong class="mt-2 block text-3xl font-bold tabular-nums tracking-tight text-slate-900">0</strong>
      </article>
      <article class="stat-tile">
        <span class="text-sm font-medium text-slate-500">Active Campaigns</span>
        <strong class="mt-2 block text-3xl font-bold tabular-nums tracking-tight text-slate-900">0</strong>
      </article>
      <article class="stat-tile">
        <span class="text-sm font-medium text-slate-500">Emails Sent</span>
        <strong class="mt-2 block text-3xl font-bold tabular-nums tracking-tight text-slate-900">0</strong>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
</script>
