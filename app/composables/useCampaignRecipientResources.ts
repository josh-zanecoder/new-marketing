import type { CampaignContactPickerRow, TenantContactTypeOption } from '~/types/tenantContact'
import { mapRecipientListPickerToCatalog } from '~/utils/campaignContactPickerCatalog'

type RecipientListOption = { id: string; name: string }

/**
 * Cached recipient-list fetches for the campaign wizard:
 * - list dropdown (`scope=lists`)
 * - manual contact picker (`scope=picker`)
 */
export function useCampaignRecipientResources() {
  const marketingApi = useTenantMarketingApi()

  const recipientLists = ref<RecipientListOption[]>([])
  const recipientListsPending = ref(false)
  const recipientListsError = ref('')

  const contactPickerTypeCounts = ref<Record<string, number> | null>(null)
  const contactPickerTypeOptions = ref<TenantContactTypeOption[]>([])
  const contactsCatalog = ref<CampaignContactPickerRow[]>([])
  const contactsCatalogPending = ref(false)
  const contactsCatalogError = ref('')
  const contactsCatalogTruncated = ref(false)

  let listOptionsPromise: ReturnType<typeof marketingApi.fetchRecipientListOptions> | null = null
  let pickerCatalogPromise: ReturnType<typeof marketingApi.fetchRecipientListPickerCatalog> | null = null

  function fetchListOptionsOnce() {
    if (!listOptionsPromise) {
      listOptionsPromise = marketingApi.fetchRecipientListOptions().catch((error) => {
        listOptionsPromise = null
        throw error
      })
    }
    return listOptionsPromise
  }

  function fetchPickerCatalogOnce() {
    if (!pickerCatalogPromise) {
      pickerCatalogPromise = marketingApi.fetchRecipientListPickerCatalog().catch((error) => {
        pickerCatalogPromise = null
        throw error
      })
    }
    return pickerCatalogPromise
  }

  async function loadRecipientLists() {
    recipientListsPending.value = true
    recipientListsError.value = ''
    try {
      const response = await fetchListOptionsOnce()
      recipientLists.value = Array.isArray(response.lists) ? response.lists : []
    } catch {
      recipientListsError.value = 'Could not load recipient lists.'
      recipientLists.value = []
    } finally {
      recipientListsPending.value = false
    }
  }

  async function loadContactsCatalog(onRowLoaded?: (row: CampaignContactPickerRow) => void) {
    contactsCatalogPending.value = true
    contactsCatalogError.value = ''
    try {
      const response = await fetchPickerCatalogOnce()
      const mapped = mapRecipientListPickerToCatalog(response)
      contactPickerTypeCounts.value = mapped.typeCounts
      contactPickerTypeOptions.value = mapped.typeOptions
      contactsCatalog.value = mapped.rows
      contactsCatalogTruncated.value = mapped.truncated
      if (onRowLoaded) {
        for (const row of contactsCatalog.value) onRowLoaded(row)
      }
    } catch {
      contactsCatalogError.value = 'Could not load contacts.'
      contactsCatalog.value = []
      contactsCatalogTruncated.value = false
      contactPickerTypeCounts.value = null
      contactPickerTypeOptions.value = []
    } finally {
      contactsCatalogPending.value = false
    }
  }

  return {
    recipientLists,
    recipientListsPending,
    recipientListsError,
    contactPickerTypeCounts,
    contactPickerTypeOptions,
    contactsCatalog,
    contactsCatalogPending,
    contactsCatalogError,
    contactsCatalogTruncated,
    loadRecipientLists,
    loadContactsCatalog
  }
}
