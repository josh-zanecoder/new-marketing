<script setup lang="ts">
definePageMeta({
  layout: false
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

interface LoginResponse {
  user?: {
    role?: string
  }
}

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

    const loginResponse = await $fetch<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email: email.value.trim() }
    })

    const role = (loginResponse?.user?.role || '').toLowerCase()
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
    <form class="login-card" @submit.prevent="handleLogin">
      <h1>Marketing Login</h1>
      <p class="subtitle">Sign in to continue to your dashboard</p>

      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="you@company.com"
        />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>

      <button type="submit" :disabled="loading">
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
  background: radial-gradient(circle at top, #f8fafc, #eef2ff 40%, #f3f4f6);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  color: #0f172a;
}

.subtitle {
  margin: -4px 0 4px;
  color: #64748b;
  font-size: 14px;
}

.field {
  display: grid;
  gap: 6px;
}

label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 11px 12px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

button {
  margin-top: 4px;
  border: 0;
  border-radius: 8px;
  padding: 11px 12px;
  background: linear-gradient(180deg, #1d4ed8, #1e40af);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 64, 175, 0.25);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin: 2px 0 0;
  color: #b91c1c;
  font-size: 13px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
