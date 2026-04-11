<script setup lang="ts">
const route = useRoute()
const { data: me, pending } = useMarketingMe()

const isDashboardActive = computed(() => route.path.startsWith('/admin/dashboard'))
const isTenantsActive = computed(() => route.path.startsWith('/admin/tenants'))

const sidebarAccount = computed(() => {
  if (!me.value || me.value.authType !== 'firebase') {
    return { primary: pending.value ? 'Loading…' : '', secondary: '' as string }
  }
  return { primary: me.value.email, secondary: 'Administrator' }
})

async function handleLogout() {
  await logoutMarketingSession()
}

const navLinkClass =
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'
const navActiveClass = '!bg-indigo-50 !text-indigo-800 ring-1 ring-indigo-100/80 shadow-sm'
const navIconClass = 'h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600'
const navIconActiveClass = '!text-indigo-600'
</script>

<template>
  <div class="flex min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
    <aside
      class="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white shadow-sm shadow-slate-900/5"
    >
      <div class="border-b border-slate-100 px-5 pb-5 pt-6">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold tracking-tight text-slate-900">
              Mortdash
            </h1>
            <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Admin console
            </p>
          </div>
        </div>

        <div
          v-if="sidebarAccount.primary || pending"
          class="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5"
        >
          <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Signed in as
          </p>
          <p
            v-if="sidebarAccount.primary"
            class="mt-1 truncate text-sm font-medium text-slate-900"
            :title="sidebarAccount.primary"
          >
            {{ sidebarAccount.primary }}
          </p>
          <p
            v-if="sidebarAccount.secondary"
            class="mt-2 inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100"
          >
            {{ sidebarAccount.secondary }}
          </p>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
        <p class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        <NuxtLink
          to="/admin/dashboard"
          :class="navLinkClass"
          :active-class="navActiveClass"
        >
          <svg :class="[navIconClass, isDashboardActive ? navIconActiveClass : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/admin/tenants"
          :class="navLinkClass"
          :active-class="navActiveClass"
        >
          <svg :class="[navIconClass, isTenantsActive ? navIconActiveClass : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 10-8 0v2m8 0H9m3-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Tenants</span>
        </NuxtLink>
      </nav>

      <div class="mt-auto border-t border-slate-100 p-3">
        <button
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          type="button"
          @click="handleLogout"
        >
          <svg class="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>
