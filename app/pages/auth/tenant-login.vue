<script setup lang="ts">
definePageMeta({ layout: false })

const host = useTenantHostContext()
if (host.isAdminHost) await navigateTo('/auth/admin-login')

const tenantName = ref('Tenant')
try {
  const context = await $fetch<{
    ok: boolean
    tenant?: { tenantName?: string | null } | null
  }>('/api/v1/auth/tenant-context')
  const resolvedName = String(context?.tenant?.tenantName || '').trim()
  if (resolvedName) tenantName.value = resolvedName
} catch {
  tenantName.value = 'Tenant'
}

const { email, password, loading, errorMessage, handleLogin } = useMarketingLogin('tenant')
</script>

<template>
  <div class="min-h-screen bg-slate-100">
    <div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside class="relative hidden overflow-hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div class="relative flex-1 px-8 py-8">
          <div class="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-pink-50" />
          <div class="relative z-10 flex h-full flex-col items-center justify-center gap-4">
            <p class="text-2xl font-semibold tracking-tight text-rose-400">{{ tenantName }}</p>
            <p class="text-6xl font-semibold tracking-wide text-rose-300/80">Marketing</p>
          </div>
        </div>
      </aside>
      <main class="flex items-center justify-center px-6 py-10">
        <form class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" @submit.prevent="handleLogin">
          <h1 class="text-4xl font-semibold tracking-tight text-slate-900">Welcome</h1>
          <div class="mt-8 space-y-5">
            <div class="space-y-2">
              <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
              <input id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@company.com" class="w-full rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
            </div>
            <div class="space-y-2">
              <label for="password" class="block text-sm font-medium text-slate-700">Password</label>
              <input id="password" v-model="password" type="password" autocomplete="current-password" required placeholder="**********" class="w-full rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
            </div>
          </div>
          <button type="submit" :disabled="loading" class="mt-8 w-full rounded-md bg-gradient-to-r from-rose-400 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
            {{ loading ? 'Signing in...' : 'Login' }}
          </button>
          <p v-if="errorMessage" class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ errorMessage }}</p>
          <p class="mt-4 text-center text-sm text-slate-400">Forgot Password?</p>
        </form>
      </main>
    </div>
  </div>
</template>
