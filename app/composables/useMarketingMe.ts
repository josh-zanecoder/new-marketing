export type MarketingMeFirebaseUser = {
  authType: 'firebase'
  uid: string
  email: string
  role: 'admin' | 'tenant' | 'client'
  tenantId: string | null
  dbName: string | null
  /** Registry `crmAppUrl` for tenant/client (not admin). */
  crmAppUrl?: string
}

export type MarketingMeApiKeyUser = {
  authType: 'apiKey'
  role: 'tenant'
  tenantName: string
  dbName: string
  tenantId?: string
  /** Registry `crmAppUrl` — CRM base URL for “Back to CRM”. */
  crmAppUrl?: string
}

export type MarketingMeUser = MarketingMeFirebaseUser | MarketingMeApiKeyUser

export type MarketingMeResponse = { ok: true; user: MarketingMeUser }

/** Current user from `GET /api/v1/auth/me` (shared across tenant/admin layouts). */
export function useMarketingMe() {
  return useAsyncData(
    'marketing-me',
    async () => {
      const reqFetch = import.meta.server ? useRequestFetch() : $fetch
      const r = await reqFetch<MarketingMeResponse>('/api/v1/auth/me', {
        credentials: 'include'
      })
      return r.user
    },
    {
      server: true,
      default: () => null,
      getCachedData: () => undefined
    }
  )
}
