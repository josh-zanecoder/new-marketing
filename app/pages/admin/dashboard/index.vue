<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type DashboardCampaign = {
  tenantDbName: string
  tenantName: string
  id: string
  name: string
  status: string
  updatedAt: string
  scheduledAt?: string
}

type AdminDashboard = {
  totalTenants: number
  activeCampaigns: number
  emailsSent: number
  sending: DashboardCampaign[]
  scheduled: DashboardCampaign[]
  failed: DashboardCampaign[]
}

const { data, pending, error, refresh } = await useAsyncData('admin-dashboard', () => {
  const reqFetch = import.meta.server ? useRequestFetch() : $fetch
  return reqFetch<AdminDashboard>('/api/v1/admin/dashboard', {
    credentials: 'include'
  })
})

const loadError = computed(() => {
  const err = error.value
  if (!err) return ''
  const dataMessage =
    err && typeof err === 'object' && 'data' in err
      ? (err as { data?: { message?: string; statusMessage?: string } }).data
      : undefined
  return (
    dataMessage?.message ||
    dataMessage?.statusMessage ||
    (err instanceof Error ? err.message : '') ||
    'Unable to load the dashboard.'
  )
})

const tiles = computed(() => [
  {
    label: 'Total tenants',
    value: data.value?.totalTenants ?? 0,
    hint: 'Registered marketing tenants'
  },
  {
    label: 'Active campaigns',
    value: data.value?.activeCampaigns ?? 0,
    hint: 'Sending, scheduled, paused, or stopped'
  },
  {
    label: 'Emails sent',
    value: data.value?.emailsSent ?? 0,
    hint: 'All-time recipient sends'
  }
])

function formatWhen(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function campaignPath(row: DashboardCampaign): string {
  return `/admin/campaigns/${encodeURIComponent(row.tenantDbName)}/${encodeURIComponent(row.id)}`
}
</script>

<template>
  <section class="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0 space-y-1">
        <p class="page-eyebrow">Admin</p>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-lead">
          Tenants, campaigns still in progress, and sends that need attention.
        </p>
      </div>
      <TenantRefreshIconButton
        label="Refresh dashboard"
        :pending="pending"
        @click="() => refresh()"
      />
    </header>

    <p v-if="pending && !data" class="text-sm text-slate-500">Loading dashboard…</p>

    <div
      v-if="loadError"
      class="rounded-2xl border border-red-200/90 bg-red-50 px-5 py-4 text-sm text-red-900"
      role="alert"
    >
      {{ loadError }}
    </div>

    <div v-if="data" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <article v-for="tile in tiles" :key="tile.label" class="stat-tile">
        <span class="text-sm font-medium text-slate-500">{{ tile.label }}</span>
        <strong class="mt-2 block text-3xl font-bold tabular-nums tracking-tight text-slate-900">
          <span v-if="pending && !data" class="inline-block h-9 w-16 animate-pulse rounded bg-slate-100" />
          <template v-else>{{ tile.value.toLocaleString() }}</template>
        </strong>
        <p class="mt-2 text-xs text-slate-400">{{ tile.hint }}</p>
      </article>
    </div>

    <div v-if="data" class="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Sending now</h2>
        <p class="mt-1 text-xs text-slate-500">Campaigns currently delivering mail.</p>
        <p v-if="pending && !data" class="mt-4 text-sm text-slate-400">Loading…</p>
        <p v-else-if="!data?.sending.length" class="mt-4 text-sm text-slate-500">
          No campaigns are sending.
        </p>
        <ul v-else class="mt-4 divide-y divide-slate-100">
          <li v-for="row in data.sending" :key="`${row.tenantDbName}:${row.id}`" class="py-3">
            <NuxtLink :to="campaignPath(row)" class="block min-w-0 rounded-lg hover:bg-slate-50">
              <p class="truncate text-sm font-semibold text-slate-900">{{ row.name }}</p>
              <p class="mt-0.5 truncate text-xs text-slate-500">
                {{ row.tenantName }} · {{ formatWhen(row.updatedAt) }}
              </p>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Scheduled sends</h2>
        <p class="mt-1 text-xs text-slate-500">Campaigns set to go out later.</p>
        <p v-if="!data.scheduled?.length" class="mt-4 text-sm text-slate-500">
          No campaigns are scheduled.
        </p>
        <ul v-else class="mt-4 divide-y divide-slate-100">
          <li v-for="row in data.scheduled" :key="`${row.tenantDbName}:${row.id}`" class="py-3">
            <NuxtLink :to="campaignPath(row)" class="block min-w-0 rounded-lg hover:bg-slate-50">
              <p class="truncate text-sm font-semibold text-slate-900">{{ row.name }}</p>
              <p class="mt-0.5 truncate text-xs text-slate-500">
                {{ row.tenantName }} · {{ formatWhen(row.scheduledAt || row.updatedAt) }}
              </p>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Failed sends</h2>
        <p class="mt-1 text-xs text-slate-500">Campaigns whose last send failed.</p>
        <p v-if="pending && !data" class="mt-4 text-sm text-slate-400">Loading…</p>
        <p v-else-if="!data?.failed.length" class="mt-4 text-sm text-slate-500">
          No failed campaigns.
        </p>
        <ul v-else class="mt-4 divide-y divide-slate-100">
          <li v-for="row in data.failed" :key="`${row.tenantDbName}:${row.id}`" class="py-3">
            <NuxtLink :to="campaignPath(row)" class="block min-w-0 rounded-lg hover:bg-slate-50">
              <p class="truncate text-sm font-semibold text-slate-900">{{ row.name }}</p>
              <p class="mt-0.5 truncate text-xs text-slate-500">
                {{ row.tenantName }} · {{ formatWhen(row.updatedAt) }}
              </p>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
