<script setup lang="ts">
import type { TenantDashboardRecentCampaign } from '~/composables/useTenantMarketingApi'

const marketingApi = useTenantMarketingApi()

const { data, pending, error, refresh } = await useAsyncData('tenant-dashboard', () =>
  marketingApi.fetchDashboard()
)

const stats = computed(() => data.value?.stats)
const recentCampaigns = computed(() => data.value?.recentCampaigns ?? [])

function formatInt(n: number) {
  return new Intl.NumberFormat().format(n)
}

function formatPercent(p: number | null | undefined) {
  if (p == null) return '—'
  return `${p % 1 === 0 ? String(p) : p.toFixed(1)}%`
}

function statusBadgeClass(status: string) {
  return {
    'bg-amber-50 text-amber-700 ring-amber-100': status === 'Draft',
    'bg-sky-50 text-sky-700 ring-sky-100': status === 'Scheduled' || status === 'Sending',
    'bg-emerald-50 text-emerald-700 ring-emerald-100': status === 'Sent',
    'bg-red-50 text-red-700 ring-red-100': status === 'Failed',
    'bg-zinc-100 text-zinc-600 ring-zinc-200/80':
      !['Draft', 'Scheduled', 'Sending', 'Sent', 'Failed'].includes(status)
  }
}

function formatUpdated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function rowSubtitle(c: TenantDashboardRecentCampaign) {
  if (c.status === 'Scheduled' && c.scheduledAt) {
    const d = new Date(c.scheduledAt)
    if (!Number.isNaN(d.getTime())) {
      const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      return `Scheduled ${md} • ${t}`
    }
  }
  if ((c.subject ?? '').trim()) {
    const s = c.subject.trim()
    return s.length > 72 ? `${s.slice(0, 69)}…` : s
  }
  return `Updated ${formatUpdated(c.updatedAt)}`
}
</script>

<template>
  <div class="w-full min-w-0 space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
        <p class="mt-1.5 text-sm text-slate-500">Overview of your marketing activity</p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm shadow-slate-900/[0.04] transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-700 disabled:pointer-events-none disabled:opacity-50"
        :disabled="pending"
        @click="() => refresh()"
      >
        Refresh
      </button>
    </header>

    <div
      v-if="error"
      class="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm text-red-800 shadow-sm"
      role="alert"
    >
      Could not load dashboard. Try again.
    </div>

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div
        class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
      >
        <p class="text-sm font-medium text-slate-500">Total campaigns</p>
        <p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          <span v-if="pending" class="text-slate-300">…</span>
          <span v-else>{{ formatInt(stats?.totalCampaigns ?? 0) }}</span>
        </p>
      </div>
      <div
        class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
      >
        <p class="text-sm font-medium text-slate-500">Emails sent this month</p>
        <p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-indigo-600">
          <span v-if="pending" class="text-slate-300">…</span>
          <span v-else>{{ formatInt(stats?.sentThisMonth ?? 0) }}</span>
        </p>
      </div>
      <div
        class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
      >
        <p class="text-sm font-medium text-slate-500">Scheduled</p>
        <p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
          <span v-if="pending" class="text-slate-300">…</span>
          <span v-else>{{ formatInt(stats?.scheduledCampaigns ?? 0) }}</span>
        </p>
        <p class="mt-2 text-xs text-slate-400">Campaigns waiting to send</p>
      </div>
      <div
        class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
      >
        <p class="text-sm font-medium text-slate-500">Delivery rate</p>
        <p class="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-emerald-600">
          <span v-if="pending" class="text-slate-300">…</span>
          <span v-else>{{ formatPercent(stats?.deliveryRatePercent ?? null) }}</span>
        </p>
        <p
          v-if="!pending && stats && stats.emailsDeliveredTotal + stats.emailsFailedTotal > 0"
          class="mt-2 text-xs text-slate-400"
        >
          {{ formatInt(stats.emailsDeliveredTotal) }} delivered,
          {{ formatInt(stats.emailsFailedTotal) }} failed
        </p>
        <p v-else-if="!pending" class="mt-2 text-xs text-slate-400">
          After sends finish (sent vs failed)
        </p>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-slate-200/80 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm shadow-slate-900/[0.04]"
    >
      <span v-if="pending" class="text-slate-400">Loading audience…</span>
      <template v-else>
        <NuxtLink
          to="/tenant/recipient-list"
          class="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
        >
          {{ formatInt(stats?.recipientLists ?? 0) }} recipient lists
        </NuxtLink>
        <span class="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <NuxtLink
          to="/tenant/contacts"
          class="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
        >
          {{ formatInt(stats?.contacts ?? 0) }} contacts
        </NuxtLink>
        <span
          v-if="stats && stats.emailsPendingTotal > 0"
          class="w-full text-slate-500 sm:ml-auto sm:w-auto"
        >
          {{ formatInt(stats.emailsPendingTotal) }} sends still queued
        </span>
      </template>
    </div>

    <div
      class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]"
    >
      <div
        class="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-6 py-5"
      >
        <div>
          <h2 class="text-base font-semibold text-slate-900">Recent campaigns</h2>
          <p class="mt-0.5 text-xs text-slate-500">Last updated activity</p>
        </div>
        <NuxtLink
          to="/tenant/campaigns"
          class="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
        >
          View all
        </NuxtLink>
      </div>

      <div v-if="pending" class="p-14 text-center text-sm text-slate-500">Loading…</div>
      <div v-else-if="recentCampaigns.length === 0" class="px-6 py-14 text-center">
        <p class="text-sm text-slate-500">No campaigns yet</p>
        <NuxtLink
          to="/tenant/campaigns/add"
          class="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700"
        >
          Create your first campaign
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="c in recentCampaigns" :key="c.id">
          <NuxtLink
            :to="`/tenant/campaigns/${c.id}`"
            class="flex flex-col gap-2 px-6 py-4 transition-colors hover:bg-slate-50/90 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-slate-900">{{ c.name || 'Untitled' }}</p>
              <p class="mt-0.5 line-clamp-2 text-xs text-slate-500">{{ rowSubtitle(c) }}</p>
            </div>
            <span
              class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="statusBadgeClass(c.status)"
            >
              {{ c.status }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
