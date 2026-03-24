<script setup lang="ts">
definePageMeta({ layout: false })

const host = useTenantHostContext()
await navigateTo(host.isTenantHost ? '/auth/tenant-login' : '/auth/admin-login', {
  redirectCode: 301
})
<<<<<<< Updated upstream

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

interface LoginResponse {
  user?: {
    role?: string
    subdomain?: string
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
    const subdomain = (loginResponse?.user?.subdomain || '').toLowerCase()
    const { setSelectedTenant } = useTenant()
    if (role === 'admin') {
      setSelectedTenant('')
      await navigateTo('/admin/dashboard')
      return
    }

    if (role === 'tenant' || role === 'client') {
      if (subdomain) setSelectedTenant(subdomain)
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
=======
>>>>>>> Stashed changes
</script>
