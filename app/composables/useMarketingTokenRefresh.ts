import type { Auth, User } from 'firebase/auth'

let sessionLogoutPromise: Promise<void> | null = null
let authPromise: Promise<Auth> | null = null

export async function getMarketingFirebaseAuth(): Promise<Auth> {
  if (authPromise) return authPromise
  authPromise = (async () => {
    const config = useRuntimeConfig()
    const publicConfig = config.public as Record<string, unknown>
    const [{ getApps, initializeApp }, { browserLocalPersistence, getAuth, setPersistence }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth')
    ])

    const app =
      getApps()[0] ||
      initializeApp({
        apiKey: String(publicConfig.firebaseApiKey || ''),
        authDomain: String(publicConfig.firebaseAuthDomain || ''),
        projectId: String(publicConfig.firebaseProjectId || ''),
        appId: String(publicConfig.firebaseAppId || '')
      })

    const auth = getAuth(app)
    await setPersistence(auth, browserLocalPersistence)
    return auth
  })()
  return authPromise
}

export function isMarketingUnauthorizedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code =
    'statusCode' in err && typeof (err as { statusCode?: number }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 'status' in err && typeof (err as { status?: number }).status === 'number'
        ? (err as { status: number }).status
        : undefined
  return code === 401
}

export async function syncMarketingTokenCookieFromFirebaseUser(user: User | null): Promise<void> {
  if (!import.meta.client) return
  const token = useCookie<string | null>('marketing_token', {
    sameSite: 'lax',
    secure: location.protocol === 'https:',
    maxAge: 60 * 60 * 24 * 7
  })
  token.value = user ? await user.getIdToken() : null
}

/** Clears cookie + Firebase session and sends the user to login (e.g. expired or revoked token). */
export function logoutMarketingSession(): Promise<void> {
  if (!import.meta.client) return Promise.resolve()
  if (sessionLogoutPromise) return sessionLogoutPromise

  sessionLogoutPromise = (async () => {
    try {
      await $fetch('/api/v1/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }

    await syncMarketingTokenCookieFromFirebaseUser(null)

    const tenantBridge = useCookie<string | null>('marketing_tenant_bridge')
    tenantBridge.value = null

    await clearNuxtData('marketing-me')

    try {
      const { getAuth, signOut } = await import('firebase/auth')
      const auth = await getMarketingFirebaseAuth()
      await signOut(getAuth(auth.app))
    } catch {
      /* ignore */
    }

    await navigateTo('/auth/login')
  })()

  return sessionLogoutPromise.finally(() => {
    sessionLogoutPromise = null
  })
}

