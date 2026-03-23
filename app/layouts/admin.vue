<script setup lang="ts">
definePageMeta({ middleware: ['tenant-guard'] })
const token = useCookie<string | null>('marketing_token')

async function handleLogout() {
  token.value = null
  await navigateTo('/auth/login')
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="w-56 shrink-0 bg-white border-r border-slate-200/80 flex flex-col">
      <div class="p-5 border-b border-slate-200/80">
        <h1 class="text-lg font-semibold text-slate-800 tracking-tight">Mortdash</h1>
        <p class="text-xs text-slate-500 mt-0.5">Admin</p>
      </div>
      <nav class="flex-1 p-3 space-y-0.5">
        <NuxtLink
          to="/admin/dashboard"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
          active-class="!bg-slate-100 !text-slate-900"
        >
          <svg class="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>Dashboard</span>
        </NuxtLink>
        <NuxtLink
          to="/admin/tenants"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
          active-class="!bg-slate-100 !text-slate-900"
        >
          <svg class="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 10-8 0v2m8 0H9m3-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
          <span>Tenants</span>
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-slate-200/80">
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 text-sm font-medium hover:bg-rose-50 hover:text-rose-700 transition-colors"
          type="button"
          @click="handleLogout"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
    <main class="flex-1 min-w-0">
      <slot />
    </main>
  </div>
</template>
