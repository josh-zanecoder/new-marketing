import type { CrmExternalConnectionMetadata } from '~~/shared/types/crmExternalConnection'

export type CreateTenantDbResult = {
  ok: boolean
  apiKey?: string
  crmExternalConnection?: CrmExternalConnectionMetadata
}

export type RegenerateTenantApiKeyResult = {
  apiKey: string | null
  crmExternalConnection?: CrmExternalConnectionMetadata
}

export function useAdminTenantsCreateDb() {
  const serverError = ref<string | null>(null)

  function resetError() {
    serverError.value = null
  }

  function normalizeError(e: unknown, fallback: string): string {
    if (e && typeof e === 'object') {
      const maybeErr = e as Record<string, unknown>
      const maybeData = maybeErr.data
      if (maybeData && typeof maybeData === 'object') {
        const maybeDataObj = maybeData as Record<string, unknown>
        const maybeMessage = maybeDataObj.message
        if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage
      }

      const maybeMessage = maybeErr.message
      if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage
    }

    if (e instanceof Error && e.message) return e.message
    return fallback
  }

  async function createTenantDb(payload: {
    name: string
    email: string
    crmAppUrl?: string
    defaultCampaignSenderEmail?: string | null
    defaultCampaignSenderName?: string | null
  }): Promise<CreateTenantDbResult> {
    resetError()

    try {
      const res = await $fetch<{
        ok: boolean
        dbName?: string
        apiKey?: string
        crmExternalConnection?: CrmExternalConnectionMetadata
      }>(
        '/api/v1/admin/tenants/create-db',
        {
          method: 'POST',
          body: {
            name: payload.name,
            email: payload.email,
            crmAppUrl: payload.crmAppUrl?.trim() ? payload.crmAppUrl.trim() : null,
            defaultCampaignSenderEmail: payload.defaultCampaignSenderEmail ?? null,
            defaultCampaignSenderName: payload.defaultCampaignSenderName ?? null
          }
        }
      )

      return {
        ok: true,
        apiKey: res?.apiKey,
        crmExternalConnection: res?.crmExternalConnection
      }
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to create tenant database')
      return { ok: false }
    }
  }

  async function regenerateTenantApiKey(dbName: string): Promise<RegenerateTenantApiKeyResult> {
    resetError()

    try {
      const res = await $fetch<{
        ok: boolean
        apiKey?: string
        crmExternalConnection?: CrmExternalConnectionMetadata
      }>(
        '/api/v1/admin/tenants/regenerate-api-key',
        { method: 'POST', body: { dbName } }
      )
      return {
        apiKey: res?.apiKey ?? null,
        crmExternalConnection: res?.crmExternalConnection
      }
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to regenerate API key')
      return { apiKey: null }
    }
  }

  async function updateTenant(
    dbName: string,
    payload: {
      name: string
      email: string | null
      crmAppUrl: string | null
      tenantId: string | null
      defaultCampaignSenderEmail: string | null
      defaultCampaignSenderName: string | null
    }
  ): Promise<{ ok: boolean }> {
    resetError()

    try {
      await $fetch(`/api/v1/admin/tenants/db/${encodeURIComponent(dbName)}`, {
        method: 'PATCH',
        body: payload
      })
      return { ok: true }
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to update tenant')
      return { ok: false }
    }
  }

  return {
    serverError,
    resetError,
    createTenantDb,
    updateTenant,
    regenerateTenantApiKey
  }
}
