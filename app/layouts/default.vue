<script setup lang="ts">
const route = useRoute()
const { data: me, pending, refresh } = useMarketingMe()

const SIDEBAR_STORAGE_KEY = 'marketing-sidebar-compact'
/** When true, sidebar shows icons only (narrow rail). */
const sidebarCompact = useState('layout-marketing-sidebar-compact', () => false)

/** Cancel any in-flight `/me` request so we always hit the server again (not a deduped no-op). */
function refreshMe() {
  return refresh({ dedupe: 'cancel' })
}

onMounted(() => {
  if (import.meta.client) {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved !== null) sidebarCompact.value = saved === 'true'
  }
  void refreshMe()
})

watch(sidebarCompact, (v) => {
  if (import.meta.client) localStorage.setItem(SIDEBAR_STORAGE_KEY, String(v))
})

function toggleSidebarCompact() {
  sidebarCompact.value = !sidebarCompact.value
}

function collapseSidebarIfMobileExpanded() {
  if (!import.meta.client) return
  if (sidebarCompact.value) return
  if (window.matchMedia('(max-width: 1023px)').matches) sidebarCompact.value = true
}

watch(
  () => route.fullPath,
  () => {
    if (import.meta.client) void refreshMe()
  }
)

const sidebarAccount = computed(() => {
  if (!me.value) return { primary: pending.value ? 'Loading…' : '', secondary: '' as string }
  const roleLabel =
    me.value.role === 'admin'
      ? 'Admin'
      : me.value.role === 'client'
        ? 'Client'
        : 'Tenant'
  return { primary: me.value.email, secondary: roleLabel }
})

/** CRM handoff / tenant API-key browser session — use “Back to tenant” instead of Logout. */
const isApiKeyBrowserSession = computed(() => me.value?.authType === 'apiKey')

const tenantBridgeCookie = useCookie<string | null>('marketing_tenant_bridge')

async function handleBackToCrm() {
  const u = me.value?.authType === 'apiKey' ? me.value.crmAppUrl : undefined
  try {
    await $fetch('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  await clearNuxtData('marketing-me')
  tenantBridgeCookie.value = null
  if (import.meta.client && u) {
    window.location.assign(u)
    return
  }
  await navigateTo('/auth/login')
}

async function handleLogout() {
  await logoutMarketingSession()
}

const navLinkClass =
  'group flex items-center gap-3 rounded-xl text-sm font-medium text-zinc-600 transition-[padding,gap] duration-200 hover:bg-zinc-100 hover:text-zinc-900'

const navLinkActiveClass =
  '!bg-zinc-900 !text-white shadow-sm !shadow-zinc-900/20 hover:!bg-zinc-800 hover:!text-white [&_span]:!text-white [&_svg]:!text-white'

const navIconClass =
  'w-5 h-5 shrink-0 text-zinc-400 group-[.router-link-active]:!text-white'

function navLinkLayoutClass(compact: boolean) {
  return compact ? 'justify-center px-2 py-2.5 [&>span]:sr-only' : 'px-3 py-2.5'
}
</script>

<template>
  <div class="flex min-h-screen bg-zinc-100 text-zinc-900 antialiased">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!sidebarCompact"
        class="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[2px] lg:hidden"
        aria-hidden="true"
        @click="sidebarCompact = true"
      />
    </Transition>

    <aside
      id="marketing-app-sidebar"
      class="fixed inset-y-0 left-0 z-50 flex h-svh min-h-0 flex-col overflow-hidden border-r border-zinc-200/80 bg-white shadow-xl shadow-zinc-950/5 transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:max-w-none lg:shrink-0 lg:shadow-none"
      :class="sidebarCompact ? 'w-16 lg:w-16' : 'w-[min(18rem,88vw)] lg:w-72'"
    >
      <div
        class="flex shrink-0 items-center gap-2 border-b border-zinc-200/80 transition-[padding] duration-200"
        :class="sidebarCompact ? 'flex-col px-2 py-3' : 'justify-between px-4 py-4 lg:px-5 lg:py-5'"
      >
        <div
          class="min-w-0 transition-[opacity] duration-200"
          :class="sidebarCompact ? 'sr-only' : 'flex-1'"
        >
          <h1 class="truncate text-base font-semibold tracking-tight text-zinc-900">
            {{ me?.authType === 'apiKey' ? me.tenantName : 'Mortdash' }}
          </h1>
          <p class="mt-0.5 text-xs font-medium text-zinc-500">Marketing</p>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          :aria-expanded="!sidebarCompact"
          aria-controls="marketing-app-sidebar-nav"
          :aria-label="sidebarCompact ? 'Expand sidebar' : 'Collapse sidebar to icons'"
          @click="toggleSidebarCompact"
        >
          <svg
            v-if="sidebarCompact"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.75"
              d="M5 6v12M10 8.5l4.5 3.5-4.5 3.5"
            />
          </svg>
          <svg
            v-else
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.75"
              d="M14.5 8.5L10 12l4.5 3.5M19 6v12"
            />
          </svg>
        </button>
      </div>

      <nav
        id="marketing-app-sidebar-nav"
        class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3"
        aria-label="Primary"
      >
        <NuxtLink
          to="/tenant/dashboard"
          :class="[navLinkClass, navLinkLayoutClass(sidebarCompact)]"
          :active-class="navLinkActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/tenant/contacts"
          :class="[navLinkClass, navLinkLayoutClass(sidebarCompact)]"
          :active-class="navLinkActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Contacts</span>
        </NuxtLink>
        <NuxtLink
          to="/tenant/recipient-list"
          :class="[navLinkClass, navLinkLayoutClass(sidebarCompact)]"
          :active-class="navLinkActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Recipient list</span>
        </NuxtLink>
        <NuxtLink
          to="/tenant/campaigns"
          :class="[navLinkClass, navLinkLayoutClass(sidebarCompact)]"
          :active-class="navLinkActiveClass"
          @click="collapseSidebarIfMobileExpanded"
        >
          <svg :class="navIconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>Campaigns</span>
        </NuxtLink>
      </nav>

      <div class="shrink-0 border-t border-zinc-200/80 p-3">
        <div
          v-if="!isApiKeyBrowserSession && !sidebarCompact"
          class="mb-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5"
        >
          <p class="truncate text-xs font-medium text-zinc-900">{{ sidebarAccount.primary }}</p>
          <p v-if="sidebarAccount.secondary" class="mt-0.5 text-xs text-zinc-500">{{ sidebarAccount.secondary }}</p>
        </div>
        <button
          v-if="isApiKeyBrowserSession"
          class="flex w-full items-center gap-3 rounded-xl text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          :class="sidebarCompact ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 text-left'"
          type="button"
          title="Back to CRM"
          @click="handleBackToCrm"
        >
          <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <span :class="sidebarCompact ? 'sr-only' : ''">Back to CRM</span>
        </button>
        <button
          v-else
          class="flex w-full items-center gap-3 rounded-xl text-sm font-medium text-zinc-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          :class="sidebarCompact ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'"
          type="button"
          title="Logout"
          @click="handleLogout"
        >
          <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
          <span :class="sidebarCompact ? 'sr-only' : ''">Logout</span>
        </button>
      </div>
    </aside>

    <main
      class="flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out lg:min-h-0 lg:pl-0"
      :class="sidebarCompact ? 'pl-16' : 'pl-[min(18rem,88vw)]'"
    >
      <div class="flex-1 p-4 sm:p-6 lg:p-8">
        <slot />
      </div>
    </main>
  </div>
</template>
