<script setup lang="ts">
/** Keep in sync with server `TENANT_AUTH_COOKIE_MAX_AGE`. */
const TENANT_SESSION_MAX_AGE = 60 * 60 * 24 * 7

definePageMeta({
  layout: false
})

const route = useRoute()
const errorMessage = ref('')
const loading = ref(true)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token.trim() : ''
  if (!token) {
    errorMessage.value = 'Missing token'
    loading.value = false
    return
  }
  try {
    try {
      const { getMarketingFirebaseAuth, syncMarketingTokenCookieFromFirebaseUser } = await import(
        '~/composables/useMarketingTokenRefresh'
      )
      const { signOut } = await import('firebase/auth')
      const auth = await getMarketingFirebaseAuth()
      await signOut(auth)
      await syncMarketingTokenCookieFromFirebaseUser(null)
    } catch {
      /* no prior Firebase session */
    }

    const res = await fetch(`${window.location.origin}/api/v1/auth/tenant-handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include'
    })
    const body = (await res.json()) as { ok?: boolean }
    if (!res.ok || !body.ok) {
      throw new Error('handoff failed')
    }

    await clearNuxtData('marketing-me')

    const bridge = useCookie<string | null>('marketing_tenant_bridge', {
      path: '/',
      sameSite: 'lax',
      secure: window.location.protocol === 'https:',
      maxAge: TENANT_SESSION_MAX_AGE
    })
    bridge.value = '1'

    window.location.replace(`${window.location.origin}/tenant/dashboard`)
  } catch {
    errorMessage.value = 'Could not sign you in. Check the link from CRM and try again.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="wrap">
    <p v-if="loading" class="muted">Signing you in…</p>
    <p v-else-if="errorMessage" class="err">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.muted {
  color: #64748b;
  font-size: 15px;
}
.err {
  color: #b91c1c;
  font-size: 14px;
  max-width: 360px;
  text-align: center;
}
</style>
