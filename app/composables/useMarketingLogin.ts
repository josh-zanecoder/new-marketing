type MarketingLoginMode = 'admin' | 'tenant'

interface LoginResponse {
  user?: {
    role?: string
    subdomain?: string | null
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

export function useMarketingLogin(mode: MarketingLoginMode) {
  const email = ref('')
  const password = ref('')
  const loading = ref(false)
  const errorMessage = ref('')
  const tenantHost = useTenantHostContext()

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
      if (mode === 'admin' && role !== 'admin') {
        errorMessage.value = 'This account is not an admin account.'
        return
      }
      if (mode === 'tenant' && role !== 'tenant' && role !== 'client') {
        errorMessage.value = 'This account is not a tenant account.'
        return
      }
      if (role === 'admin') {
        if (tenantHost.isTenantHost) {
          window.location.href = `${window.location.protocol}//${tenantHost.baseDomain}/admin/dashboard`
          return
        }
        await navigateTo('/admin/dashboard')
        return
      }
      if (role === 'tenant' || role === 'client') {
        const subdomain = String(loginResponse?.user?.subdomain || '').trim().toLowerCase()
        if (!tenantHost.isTenantHost && subdomain) {
          window.location.href = `${window.location.protocol}//${subdomain}.${tenantHost.baseDomain}/tenant/dashboard`
          return
        }
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

  return { email, password, loading, errorMessage, handleLogin }
}
