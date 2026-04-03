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
  /** Forwarded operator id (`x-tenant-user-id` / legacy `x-crm-user-id`). */
  tenantUserId?: string
  /** Handoff JWT or `x-tenant-user-email`. */
  email?: string
  /** `x-tenant-user-name`. */
  name?: string
  firstName?: string
  lastName?: string
  phone?: string
  /** Tenant role display name (Marketing auth role remains `tenant`). */
  tenantRole?: string
  /** Handoff: emails allowed for contact ownership filter. */
  contactOwnerEmails?: string[]
  /** When true, no contact owner filter (`users:own-ae-only` off). */
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
      const r = (await reqFetch('/api/v1/auth/me', {
        credentials: 'include'
      })) as MarketingMeResponse
      return r.user
    },
    {
      server: true,
      default: () => null
    }
  )
}
