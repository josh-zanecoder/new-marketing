<script setup lang="ts">
const { data: me, pending } = useMarketingMe()

const SIDEBAR_STORAGE_KEY = 'admin-sidebar-compact'
const MOBILE_SIDEBAR_MQ = '(max-width: 1023px)'

const sidebarCompact = useState('layout-admin-sidebar-compact', () => false)
const isMobileViewport = ref(false)

let sidebarMediaQuery: MediaQueryList | null = null
let sidebarEscListener: ((e: KeyboardEvent) => void) | null = null

const mobileDrawerOpen = computed(() => isMobileViewport.value && !sidebarCompact.value)
const mainScrollRef = ref<HTMLElement | null>(null)

const sidebarAccount = computed(() => {
  if (!me.value || me.value.authType !== 'firebase') {
    return { primary: pending.value ? 'Loading…' : '', secondary: '' as string }
  }
  return { primary: me.value.email, secondary: 'Administrator' }
})

function syncMobileViewport() {
  if (!import.meta.client) return
  isMobileViewport.value = window.matchMedia(MOBILE_SIDEBAR_MQ).matches
}

function clearSidebarEscListener() {
  if (!sidebarEscListener) return
  window.removeEventListener('keydown', sidebarEscListener)
  sidebarEscListener = null
}

function syncMobileDrawerSideEffects() {
  if (!import.meta.client) return

  const drawerOpen = mobileDrawerOpen.value
  const main = mainScrollRef.value
  if (main) main.style.overflow = drawerOpen ? 'hidden' : ''

  clearSidebarEscListener()
  if (drawerOpen) {
    sidebarEscListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sidebarCompact.value = true
    }
    window.addEventListener('keydown', sidebarEscListener)
  }
}

onMounted(() => {
  if (!import.meta.client) return
  const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
  syncMobileViewport()
  if (saved !== null) {
    sidebarCompact.value = saved === 'true'
  } else if (isMobileViewport.value) {
    sidebarCompact.value = true
  }
  sidebarMediaQuery = window.matchMedia(MOBILE_SIDEBAR_MQ)
  sidebarMediaQuery.addEventListener('change', syncMobileViewport)
  syncMobileDrawerSideEffects()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  sidebarMediaQuery?.removeEventListener('change', syncMobileViewport)
  clearSidebarEscListener()
})

watch(sidebarCompact, (v) => {
  if (import.meta.client) localStorage.setItem(SIDEBAR_STORAGE_KEY, String(v))
  syncMobileDrawerSideEffects()
})

watch(isMobileViewport, () => {
  syncMobileDrawerSideEffects()
})

function toggleSidebarCompact() {
  sidebarCompact.value = !sidebarCompact.value
}

function collapseSidebarIfMobileExpanded() {
  if (!import.meta.client) return
  if (sidebarCompact.value) return
  if (window.matchMedia(MOBILE_SIDEBAR_MQ).matches) sidebarCompact.value = true
}

async function handleLogout() {
  await logoutMarketingSession()
}

const navLinkClass = 'nav-item'
const navActiveClass = 'nav-item-active'
const navIconClass = 'nav-item-icon'
</script>

<template>
  <div class="flex h-svh min-h-0 overflow-hidden bg-[var(--color-background)] text-slate-900 antialiased">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!sidebarCompact"
        class="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="sidebarCompact = true"
      />
    </Transition>

    <aside
      id="admin-app-sidebar"
      class="admin-app-sidebar fixed inset-y-0 left-0 z-50 flex h-svh min-h-0 w-[min(16rem,88vw)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl shadow-slate-900/10 transition-transform duration-200 ease-smooth lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none"
      :class="sidebarCompact ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'"
    >
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-5 lg:pb-5 lg:pt-6">
        <div class="min-w-0">
          <h1 class="text-lg font-bold tracking-tight text-slate-900">
            Mortdash
          </h1>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Admin console
          </p>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 lg:hidden"
          aria-label="Close menu"
          @click="sidebarCompact = true"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        v-if="sidebarAccount.primary || pending"
        class="mx-3 mb-1 rounded-card border border-slate-200 bg-slate-50 p-3.5 shadow-sm"
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
          class="mt-2 inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-primary-700 ring-1 ring-primary-100"
        >
          {{ sidebarAccount.secondary }}
        </p>
      </div>

      <nav
        class="admin-sidebar-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-4"
        aria-label="Admin navigation"
      >
        <p class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        <NuxtLink
          to="/admin/dashboard"
          :class="navLinkClass"
          :active-class="navActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/admin/tenants"
          :class="navLinkClass"
          :active-class="navActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 10-8 0v2m8 0H9m3-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Tenants</span>
        </NuxtLink>
      </nav>

      <div class="mt-auto shrink-0 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

    <main
      ref="mainScrollRef"
      class="admin-main-scroll main-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain"
    >
      <header class="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-[var(--page-bg-alt)] px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-sm lg:hidden">
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          :aria-expanded="!sidebarCompact"
          aria-controls="admin-app-sidebar"
          aria-label="Open menu"
          @click="toggleSidebarCompact"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span class="truncate text-sm font-semibold text-slate-900">Admin console</span>
      </header>

      <div class="flex-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-sidebar-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.admin-sidebar-scroll::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .admin-app-sidebar {
    transition-duration: 0.01ms !important;
  }
}
</style>
