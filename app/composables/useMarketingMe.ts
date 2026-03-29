export type MarketingMeFirebaseUser = {
  authType: 'firebase'
  uid: string
  email: string
  role: 'admin' | 'tenant' | 'client'
  tenantId: string | null
  dbName: string | null
}

export type MarketingMeApiKeyUser = {
  authType: 'apiKey'
  role: 'tenant'
  tenantName: string
  dbName: string
  tenantId?: string
}

export type MarketingMeUser = MarketingMeFirebaseUser | MarketingMeApiKeyUser

export type MarketingMeResponse = { ok: true; user: MarketingMeUser }

/** Current user from `GET /api/v1/auth/me` (shared across tenant/admin layouts). */
export function useMarketingMe() {
  return useAsyncData(
    'marketing-me',
    () => $fetch<MarketingMeResponse>('/api/v1/auth/me').then((r) => r.user),
    {
      server: true,
      default: () => null,
      getCachedData: () => undefined
    }
  )
}
