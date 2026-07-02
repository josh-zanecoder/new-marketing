<script setup lang="ts">
import type { TenantDashboardRecentCampaign } from '~/composables/useTenantMarketingApi'

definePageMeta({ layout: 'default' })

const marketingApi = useTenantMarketingApi()

const { data, pending, error, refresh } = await useAsyncData('tenant-dashboard', () =>
  marketingApi.fetchDashboard()
)

const stats = computed(() => data.value?.stats)
const recentCampaigns = computed(() => data.value?.recentCampaigns ?? [])

interface StatCard {
  id: string
  label: string
  value: string
  hint?: string
  cardClass: string
  iconBgClass: string
  iconClass: string
}

const statCards = computed((): StatCard[] => {
  const s = stats.value
  const loading = pending.value

  const deliveryHint =
    !loading && s && s.emailsDeliveredTotal + s.emailsFailedTotal > 0
      ? `${formatInt(s.emailsDeliveredTotal)} delivered, ${formatInt(s.emailsFailedTotal)} failed`
      : !loading
        ? 'After sends finish (sent vs failed)'
        : undefined

  return [
    {
      id: 'total-campaigns',
      label: 'Total campaigns',
      value: loading ? '…' : formatInt(s?.totalCampaigns ?? 0),
      cardClass: 'border-slate-200 bg-white',
      iconBgClass: 'bg-slate-100',
      iconClass: 'text-slate-600'
    },
    {
      id: 'sent-month',
      label: 'Emails sent this month',
      value: loading ? '…' : formatInt(s?.sentThisMonth ?? 0),
      cardClass: 'border-slate-200 bg-white',
      iconBgClass: 'bg-primary-50',
      iconClass: 'text-primary-600'
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      value: loading ? '…' : formatInt(s?.scheduledCampaigns ?? 0),
      hint: 'Campaigns waiting to send',
      cardClass: 'border-slate-200 bg-white',
      iconBgClass: 'bg-sky-50',
      iconClass: 'text-sky-600'
    },
    {
      id: 'delivery-rate',
      label: 'Delivery rate',
      value: loading ? '…' : formatPercent(s?.deliveryRatePercent ?? null),
      hint: deliveryHint,
      cardClass: 'border-emerald-200 bg-emerald-50/40',
      iconBgClass: 'bg-emerald-100',
      iconClass: 'text-emerald-600'
    }
  ]
})

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
  <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Overview</p>
        <h1 class="page-title">
          Dashboard
        </h1>
        <p class="page-lead">Your marketing activity at a glance</p>
      </div>
      <div class="flex items-center gap-2 sm:shrink-0">
        <NuxtLink
          to="/tenant/campaigns/add"
          class="btn-cta"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New campaign
        </NuxtLink>
        <button
          type="button"
          class="btn-outline"
          :disabled="pending"
          @click="() => refresh()"
        >
          <svg
            class="h-4 w-4"
            :class="pending ? 'animate-spin' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>
    </header>

    <div
      v-if="error"
      class="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3.5 text-sm text-red-800 shadow-sm"
      role="alert"
    >
      Could not load dashboard. Try again.
    </div>

    <section aria-label="Key metrics">
      <div
        v-if="pending"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="animate-pulse stat-tile"
        >
          <div class="h-10 w-10 rounded-xl bg-slate-100" />
          <div class="mt-4 h-3.5 w-24 rounded bg-slate-100" />
          <div class="mt-3 h-8 w-16 rounded bg-slate-100" />
        </div>
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <article
          v-for="card in statCards"
          :key="card.id"
          class="stat-tile"
          :class="card.cardClass"
        >
          <div class="flex items-start justify-between gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
              :class="card.iconBgClass"
            >
              <svg
                v-if="card.id === 'total-campaigns'"
                class="h-5 w-5"
                :class="card.iconClass"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <svg
                v-else-if="card.id === 'sent-month'"
                class="h-5 w-5"
                :class="card.iconClass"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
              <svg
                v-else-if="card.id === 'scheduled'"
                class="h-5 w-5"
                :class="card.iconClass"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                :class="card.iconClass"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p class="mt-3 text-xs font-medium text-slate-500 sm:text-sm">{{ card.label }}</p>
          <p
            class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-2 sm:text-3xl"
            :class="{
              'text-primary-600': card.id === 'sent-month',
              'text-emerald-600': card.id === 'delivery-rate' && card.value !== '—'
            }"
          >
            {{ card.value }}
          </p>
          <p v-if="card.hint" class="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-400 sm:text-xs">
            {{ card.hint }}
          </p>
        </article>
      </div>
    </section>

    <section
      aria-label="Audience summary"
      class="surface-card overflow-hidden"
    >
      <div v-if="pending" class="px-4 py-4 text-sm text-slate-400 sm:px-6">Loading audience…</div>
      <div
        v-else
        class="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <NuxtLink
          to="/tenant/recipient-list"
          class="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50/90 sm:px-6"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-lg font-semibold tabular-nums text-slate-900">
              {{ formatInt(stats?.recipientLists ?? 0) }}
            </p>
            <p class="text-xs font-medium text-primary-600 group-hover:text-primary-700">Recipient lists</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/tenant/contacts"
          class="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50/90 sm:px-6"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition-colors group-hover:bg-violet-100"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-lg font-semibold tabular-nums text-slate-900">
              {{ formatInt(stats?.contacts ?? 0) }}
            </p>
            <p class="text-xs font-medium text-primary-600 group-hover:text-primary-700">Contacts</p>
          </div>
        </NuxtLink>

        <div class="flex items-center gap-3 px-4 py-4 sm:px-6">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div class="min-w-0">
            <p class="text-lg font-semibold tabular-nums text-slate-900">
              {{ formatInt(stats?.emailsPendingTotal ?? 0) }}
            </p>
            <p class="text-xs text-slate-500">Sends still queued</p>
          </div>
        </div>
      </div>
    </section>

    <section
      aria-label="Recent campaigns"
      class="surface-card overflow-hidden"
    >
      <div
        class="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5"
      >
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-slate-900">Recent campaigns</h2>
          <p class="mt-0.5 text-xs text-slate-500">Last updated activity</p>
        </div>
        <NuxtLink
          to="/tenant/campaigns"
          class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          View all
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <div v-if="pending" class="space-y-3 p-4 sm:p-6">
        <div v-for="n in 3" :key="n" class="animate-pulse rounded-xl border border-slate-100 p-4">
          <div class="h-4 w-2/3 max-w-xs rounded bg-slate-100" />
          <div class="mt-2 h-3 w-1/2 max-w-[12rem] rounded bg-slate-100" />
        </div>
      </div>

      <div v-else-if="recentCampaigns.length === 0" class="px-4 py-10 text-center sm:px-6 sm:py-14">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p class="mt-4 text-sm font-medium text-slate-900">No campaigns yet</p>
        <p class="mt-1 text-sm text-slate-500">Create your first campaign to start sending.</p>
        <NuxtLink
          to="/tenant/campaigns/add"
          class="mt-5 btn-cta w-full sm:w-auto"
        >
          Create your first campaign
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <ul v-else class="divide-y divide-slate-100">
        <li v-for="c in recentCampaigns" :key="c.id">
          <NuxtLink
            :to="`/tenant/campaigns/${c.id}`"
            class="block px-4 py-3.5 transition-colors hover:bg-slate-50/90 sm:px-6 sm:py-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-900 sm:text-[15px]">
                  {{ c.name || 'Untitled' }}
                </p>
                <p class="mt-0.5 line-clamp-2 text-xs text-slate-500">{{ rowSubtitle(c) }}</p>
              </div>
              <span
                class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset sm:text-xs"
                :class="statusBadgeClass(c.status)"
              >
                {{ c.status }}
              </span>
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
