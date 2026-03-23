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
    subdomain: string
  }): Promise<{ ok: boolean; apiKey?: string }> {
    resetError()

    try {
      const res = await $fetch<{ ok: boolean; dbName?: string; apiKey?: string }>(
        '/api/v1/admin/tenants/create-db',
        {
          method: 'POST',
          body: { name: payload.name, email: payload.email, subdomain: payload.subdomain }
        }
      )

      return { ok: true, apiKey: res?.apiKey }
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to create tenant database')
      return { ok: false }
    }
  }

  async function regenerateTenantApiKey(dbName: string): Promise<string | null> {
    resetError()

    try {
      const res = await $fetch<{ ok: boolean; apiKey?: string }>(
        '/api/v1/admin/tenants/regenerate-api-key',
        { method: 'POST', body: { dbName } }
      )
      return res?.apiKey ?? null
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to regenerate API key')
      return null
    }
  }

  return {
    serverError,
    resetError,
    createTenantDb,
    regenerateTenantApiKey
  }
}
