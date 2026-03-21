<template>
  <div class="p-6 lg:p-8">
    <header class="mb-8">
      <h1 class="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
      <p class="mt-1 text-slate-500 text-sm">Overview of your marketing activity</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <div class="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Total Campaigns</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">0</p>
      </div>
      <div class="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Sent This Month</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">0</p>
      </div>
      <div class="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Open Rate</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">—</p>
      </div>
      <div class="rounded-xl bg-white border border-slate-200/80 p-5 shadow-sm">
        <p class="text-sm font-medium text-slate-500">Click Rate</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">—</p>
      </div>
    </div>

    <div class="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-200/80">
        <h2 class="text-sm font-semibold text-slate-900">Recent Campaigns</h2>
        <p class="text-xs text-slate-500 mt-0.5">Your latest email campaigns</p>
      </div>
      <div class="p-12 text-center">
        <p class="text-slate-500 text-sm">No campaigns yet</p>
        <NuxtLink
          to="/tenant/campaigns/add"
          class="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Create your first campaign
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
