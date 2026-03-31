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
  /** From CRM `x-crm-user-id` when calling Marketing with the tenant API key. */
  crmUserId?: string
  /** From CRM `x-crm-user-email` or handoff JWT. */
  email?: string
  /** From CRM `x-crm-user-name`. */
  name?: string
  /** From CRM handoff JWT or `x-crm-user-first-name`. */
  firstName?: string
  lastName?: string
  phone?: string
  /** CRM tenant role display name (Marketing auth role remains `tenant`). */
  crmRole?: string
  /** CRM handoff: emails allowed for contact ownership filter. */
  contactOwnerEmails?: string[]
  /** When true, Marketing does not filter contacts by owner (CRM user without `users:own-ae-only`). */
  tenantWideContacts?: true
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
      default: () => null
    }
  )
}
