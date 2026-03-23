/**
 * Firebase ID tokens expire in ~1h; `marketing_token` cookie maxAge is longer.
 * Refresh from the Firebase session and update the cookie before API calls (client only).
 */
export async function refreshMarketingTokenIfNeeded(): Promise<void> {
  if (!import.meta.client) return

  const token = useCookie<string | null>('marketing_token')
  if (!token.value?.trim()) return

  try {
    const parts = token.value.split('.')
    const payloadPart = parts[1]
    if (parts.length === 3 && payloadPart) {
      const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(b64)) as { exp?: number }
      const exp = typeof payload.exp === 'number' ? payload.exp : 0
      const now = Math.floor(Date.now() / 1000)
      if (exp > now + 120) return
    }
  } catch {
    /* attempt refresh below */
  }

  const config = useRuntimeConfig()
  const publicConfig = config.public as Record<string, unknown>

  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth')
  ])

  const firebaseApp =
    getApps()[0] ||
    initializeApp({
      apiKey: String(publicConfig.firebaseApiKey || ''),
      authDomain: String(publicConfig.firebaseAuthDomain || ''),
      projectId: String(publicConfig.firebaseProjectId || ''),
      appId: String(publicConfig.firebaseAppId || '')
    })

  const auth = getAuth(firebaseApp)
  const user = auth.currentUser
  if (!user) return

  const fresh = await user.getIdToken(true)
  token.value = fresh
}
