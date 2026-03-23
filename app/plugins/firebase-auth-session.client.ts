import { onIdTokenChanged } from 'firebase/auth'
import {
  getMarketingFirebaseAuth,
  isMarketingUnauthorizedError,
  logoutMarketingSession,
  syncMarketingTokenCookieFromFirebaseUser
} from '~/composables/useMarketingTokenRefresh'

function requestUrl(request: unknown): string {
  if (typeof request === 'string') return request
  if (request && typeof request === 'object' && 'url' in request) {
    const url = (request as { url?: string }).url
    if (typeof url === 'string') return url
  }
  return String(request)
}

type MinimalFetch = ((request: unknown, options?: unknown) => Promise<unknown>) & {
  raw?: unknown
  create?: unknown
}

export default defineNuxtPlugin({
  name: 'firebase-auth-session',
  async setup() {
    if (!import.meta.client) return
    try {
      const base = globalThis.$fetch as unknown as MinimalFetch
      if (typeof base === 'function') {
        const wrapped: MinimalFetch = async (request: unknown, options?: unknown) => {
          try {
            return await base(request, options)
          } catch (err: unknown) {
            if (!isMarketingUnauthorizedError(err)) throw err
            if (requestUrl(request).includes('/api/v1/auth/')) throw err
            await logoutMarketingSession()
            return undefined
          }
        }
        Object.assign(wrapped, { raw: base.raw, create: base.create })
        globalThis.$fetch = wrapped as unknown as typeof globalThis.$fetch
      }

      const auth = await getMarketingFirebaseAuth()
      onIdTokenChanged(auth, async (user) => {
        await syncMarketingTokenCookieFromFirebaseUser(user)
      })
    } catch {
      await logoutMarketingSession()
    }
  }
})
