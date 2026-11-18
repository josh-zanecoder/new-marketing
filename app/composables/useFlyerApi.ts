export type TenantFlyerRow = {
  id: string
  name: string
  categoryId?: string | null
  categoryName?: string | null
  imageUrl: string
  objectPath: string
  fileName?: string
  contentType?: string
  size?: number
  createdAt?: string | null
  updatedAt?: string | null
}

/** Feature-scoped Custom Flyers HTTP client (keeps useTenantMarketingApi thin). */
export function useFlyerApi() {
  const { tenantFetchInit } = useTenantMarketingApi()

  async function fetchFlyers() {
    return $fetch<{ flyers: TenantFlyerRow[] }>(
      '/api/v1/tenant/flyers',
      tenantFetchInit()
    )
  }

  async function createFlyer(body: {
    name: string
    dataUrl: string
    categoryId?: string | null
    originalFileName?: string | null
  }) {
    return $fetch<{ ok: boolean; flyer: TenantFlyerRow }>(
      '/api/v1/tenant/flyers',
      tenantFetchInit({ method: 'POST', body, timeout: 120000 })
    )
  }

  async function deleteFlyer(flyerId: string) {
    return $fetch<{ ok: boolean }>(
      `/api/v1/tenant/flyers/${encodeURIComponent(flyerId)}`,
      tenantFetchInit({ method: 'DELETE', timeout: 60000 })
    )
  }

  return {
    fetchFlyers,
    createFlyer,
    deleteFlyer
  }
}
