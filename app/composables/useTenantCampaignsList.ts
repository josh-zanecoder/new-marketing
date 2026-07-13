export interface TenantCampaignListItem {
  id: string
  name: string
}

const TENANT_CAMPAIGNS_LIST_KEY = TENANT_CAMPAIGNS_LIST_CACHE_KEY

export function useTenantCampaignsList(options?: { lazy?: boolean }) {
  const fetchResult = useFetch<{ campaigns: TenantCampaignListItem[] }>(
    '/api/v1/tenant/campaigns',
    {
      key: TENANT_CAMPAIGNS_LIST_KEY,
      lazy: options?.lazy ?? false,
      getCachedData: (key, nuxtApp) => readNuxtPayloadCache(key, nuxtApp)
    }
  )

  const campaignNameById = computed(() => {
    const map = new Map<string, string>()
    for (const campaign of fetchResult.data.value?.campaigns ?? []) {
      const id = campaign.id?.trim()
      if (id) map.set(id, (campaign.name ?? '').trim() || id)
    }
    return map
  })

  function campaignDisplayLabel(campaignId: string | null | undefined): string {
    const id = campaignId?.trim()
    if (!id) return ''
    return campaignNameById.value.get(id) ?? id
  }

  return {
    ...fetchResult,
    campaignNameById,
    campaignDisplayLabel
  }
}
