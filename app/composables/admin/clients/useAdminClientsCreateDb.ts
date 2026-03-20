export function useAdminClientsCreateDb() {
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

  async function createClientDb(payload: {
    name: string
    email: string
  }): Promise<{ ok: boolean; clientKey?: string }> {
    resetError()

    try {
      const res = await $fetch<{ ok: boolean; dbName?: string; clientKey?: string }>(
        '/api/v1/admin/clients/create-db',
        {
          method: 'POST',
          body: { name: payload.name, email: payload.email }
        }
      )

      return { ok: true, clientKey: res?.clientKey }
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to create client database')
      return { ok: false }
    }
  }

  async function regenerateClientKey(dbName: string): Promise<string | null> {
    resetError()

    try {
      const res = await $fetch<{ ok: boolean; clientKey?: string }>(
        '/api/v1/admin/clients/regenerate-client-key',
        { method: 'POST', body: { dbName } }
      )
      return res?.clientKey ?? null
    } catch (e: unknown) {
      serverError.value = normalizeError(e, 'Failed to regenerate client key')
      return null
    }
  }

  return {
    serverError,
    resetError,
    createClientDb,
    regenerateClientKey
  }
}

