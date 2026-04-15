<script setup lang="ts">
import { marketingTenantHandoffCookieBase } from '~~/shared/marketingTenantHandoffCookies'

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
    const rawText = await res.text()
    let body: { ok?: boolean; message?: string; data?: { message?: string } } = {}
    try {
      body = rawText ? (JSON.parse(rawText) as typeof body) : {}
    } catch {
      throw new Error(rawText.slice(0, 200) || 'Invalid response from sign-in service')
    }
    if (!res.ok || !body.ok) {
      const detail =
        (typeof body.data?.message === 'string' && body.data.message) ||
        (typeof body.message === 'string' && body.message) ||
        `Handoff failed (${res.status})`
      throw new Error(detail)
    }

    await clearNuxtData('marketing-me')

    /** Mirror server cookie attrs so middleware sees the bridge flag if Set-Cookie was delayed. */
    const bridge = useCookie<string | null>('marketing_tenant_bridge', marketingTenantHandoffCookieBase())
    bridge.value = '1'

    window.location.replace(`${window.location.origin}/tenant/dashboard`)
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message ? e.message : ''
    errorMessage.value = msg
      ? `Could not sign you in: ${msg}`
      : 'Could not sign you in. Check the link from CRM and try again.'
    console.error('[auth/tenant-callback]', e)
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
