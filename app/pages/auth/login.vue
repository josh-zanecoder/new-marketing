<script setup lang="ts">
import { isCrmEmbedSession, redirectToMarketingEmbedAuthFallback } from '~/composables/useMarketingEmbed'

definePageMeta({
  layout: false
})

if (import.meta.server && isCrmEmbedSession()) {
  await navigateTo('/auth/tenant-session-expired')
}

onMounted(() => {
  if (isCrmEmbedSession()) {
    redirectToMarketingEmbedAuthFallback()
  }
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

function loginErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const message =
      'data' in error &&
      error.data &&
      typeof error.data === 'object' &&
      'message' in error.data &&
      typeof error.data.message === 'string'
        ? error.data.message
        : null
    if (message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Login failed'
}

async function handleLogin() {
  errorMessage.value = ''
  loading.value = true

  try {
    const [{ signInWithEmailAndPassword }, auth] = await Promise.all([
      import('firebase/auth'),
      getMarketingFirebaseAuth()
    ])
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value)
    await syncMarketingTokenCookieFromFirebaseUser(auth.currentUser)

    const { user } = await $fetch<MarketingMeResponse>('/api/v1/auth/me')
    const role = user.authType === 'firebase' ? user.role.toLowerCase() : 'tenant'
    if (role === 'admin') {
      await navigateTo('/admin/dashboard')
      return
    }

    if (role === 'tenant' || role === 'client') {
      await navigateTo('/tenant/dashboard')
      return
    }

    errorMessage.value = 'Unknown user role'
  } catch (error: unknown) {
    errorMessage.value = loginErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="card login-card" @submit.prevent="handleLogin">
      <h1>Marketing Login</h1>
      <p class="subtitle">Sign in to continue to your dashboard</p>

      <div class="field">
        <label class="label" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          class="input"
          type="email"
          autocomplete="email"
          required
          placeholder="you@company.com"
        >
      </div>

      <div class="field">
        <label class="label" for="password">Password</label>
        <input
          id="password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        >
      </div>

      <button class="btn btn-primary login-submit" type="submit" :disabled="loading">
        {{ loading ? 'Signing in...' : 'Login' }}
      </button>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, var(--page-bg-alt), var(--primary-50) 40%, var(--background-secondary));
  padding: var(--space-6);
}

.login-card {
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: 14px;
  border-radius: var(--radius-xl);
  border-color: var(--border-slate);
  box-shadow: var(--shadow-modal);
}

.login-card .label {
  margin-bottom: 0;
}

h1 {
  margin: 0;
  font-size: var(--font-size-3xl);
  line-height: var(--line-height-tight);
  color: var(--text-heading);
}

.subtitle {
  margin: -4px 0 4px;
  color: var(--text-muted);
  font-size: var(--font-size-base);
}

.field {
  display: grid;
  gap: 6px;
}

.login-submit {
  margin-top: 4px;
  width: 100%;
  padding: 11px 12px;
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-button);
  box-shadow: var(--shadow-cta);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.login-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-cta-hover);
}

.login-submit:active:not(:disabled) {
  transform: translateY(0);
}

.login-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin: 2px 0 0;
  color: var(--button-danger-hover);
  font-size: var(--font-size-base-sm);
  background: var(--status-error-bg);
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  padding: 8px 10px;
}
</style>
