import { readFlyerFileAsDataUrl } from '~/utils/readFlyerFileAsDataUrl'
import type { TenantEmailTemplateCategoryRow } from '~/composables/useTenantMarketingApi'
import type { TenantFlyerRow } from '~/composables/useFlyerApi'
import { openFlyerForPrint } from '~~/shared/utils/flyerPrint'
import {
  EMAIL_TEMPLATE_CATEGORIES_MANAGE_PATH,
  FLYER_CATEGORY_QUERY_KEY,
  FLYER_NAME_MAX_LENGTH,
  TENANT_FLYERS_CACHE_KEY
} from '~~/shared/constants/flyerCategory'
import { EMAIL_TEMPLATE_CATEGORY_FILTER_ALL } from '~~/shared/constants/emailTemplateCategory'
import { TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY } from '~/composables/useNuxtPayloadCache'
import {
  buildEmailTemplateCategoryAssignOptions,
  buildEmailTemplateCategoryFilterOptions,
  matchesEmailTemplateCategoryFilter,
  parseEmailTemplateCategoryFilterQuery,
  type EmailTemplateCategoryFilterValue
} from '~~/shared/utils/emailTemplateCategory'
import {
  groupFlyersByCategory,
  type FlyerGroupItem
} from '~~/shared/utils/groupFlyersByCategory'
import {
  buildFlyerDeleteConfirmMessage,
  FLYER_DELETE_CONFIRM_TEXT,
  FLYER_DELETE_CONFIRM_TITLE
} from '~~/shared/constants/flyerUploadCopy'
import { formatFlyerFileSize } from '~~/shared/utils/formatFlyerFileSize'
import { normalizeFlyerName } from '~~/shared/utils/normalizeFlyerName'
import { isFlyerImageMime } from '~~/shared/utils/flyerUpload'

/** Page logic for Custom Flyers: reuse Template categories for grouping. */
export function useMarketingFlyersPage() {
  const route = useRoute()
  const router = useRouter()
  const toast = useAppToast()
  const flyerApi = useFlyerApi()
  const marketingApi = useTenantMarketingApi()
  const { canReadFlyers, canAddFlyers, canDeleteFlyers } = useMarketingFlyersPermissions()

  const pending = ref(true)
  const uploadPending = ref(false)
  const addModalOpen = ref(false)
  const previewOpen = ref(false)
  const previewFlyer = ref<FlyerGroupItem | null>(null)
  const flyerToDelete = ref<{ id: string; name: string } | null>(null)
  const deleteConfirmLoading = ref(false)
  const loadError = ref('')
  const formError = ref('')
  const uploadingFlyerName = ref('')

  const deleteModalMessage = computed(() =>
    buildFlyerDeleteConfirmMessage(flyerToDelete.value?.name || '')
  )

  const flyers = ref<TenantFlyerRow[]>([])
  const categories = ref<TenantEmailTemplateCategoryRow[]>([])

  const flyerName = ref('')
  const selectedCategoryId = ref('')
  const pendingFlyerFile = ref<File | null>(null)
  const pendingFlyerPreviewUrl = ref('')

  const pendingFlyerFileName = computed(() => pendingFlyerFile.value?.name?.trim() || '')
  const pendingFlyerContentType = computed(() => pendingFlyerFile.value?.type || '')
  const pendingFlyerSizeLabel = computed(() =>
    pendingFlyerFile.value ? formatFlyerFileSize(pendingFlyerFile.value.size) : ''
  )
  const canSubmitFlyer = computed(() => {
    const name = normalizeFlyerName(flyerName.value).slice(0, FLYER_NAME_MAX_LENGTH)
    return Boolean(name && pendingFlyerFile.value && canAddFlyers.value && !uploadPending.value)
  })

  function revokePendingFlyerPreview() {
    if (!pendingFlyerPreviewUrl.value) return
    if (import.meta.client) URL.revokeObjectURL(pendingFlyerPreviewUrl.value)
    pendingFlyerPreviewUrl.value = ''
  }

  function setPendingFlyerFile(file: File | null) {
    revokePendingFlyerPreview()
    pendingFlyerFile.value = file
    if (
      file &&
      import.meta.client &&
      isFlyerImageMime(file.type)
    ) {
      pendingFlyerPreviewUrl.value = URL.createObjectURL(file)
    }
  }

  if (import.meta.client) {
    onUnmounted(revokePendingFlyerPreview)
  }

  const categoryFilter = computed<EmailTemplateCategoryFilterValue>(() =>
    parseEmailTemplateCategoryFilterQuery(route.query[FLYER_CATEGORY_QUERY_KEY])
  )

  const categoryFilterOptions = computed(() =>
    buildEmailTemplateCategoryFilterOptions(categories.value)
  )
  const categoryAssignOptions = computed(() =>
    buildEmailTemplateCategoryAssignOptions(categories.value)
  )

  const filteredFlyers = computed(() =>
    flyers.value.filter((flyer) =>
      matchesEmailTemplateCategoryFilter(flyer.categoryId, categoryFilter.value)
    )
  )

  const categoryGroups = computed(() => {
    const groups = groupFlyersByCategory(filteredFlyers.value, categories.value)
    if (categoryFilter.value === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL) return groups
    return groups.filter((group) => group.items.length > 0)
  })

  const busy = computed(() => pending.value || uploadPending.value)

  function setCategoryFilter(value: string) {
    const next = parseEmailTemplateCategoryFilterQuery(value)
    const query = { ...route.query }
    if (next === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL) {
      delete query[FLYER_CATEGORY_QUERY_KEY]
    } else {
      query[FLYER_CATEGORY_QUERY_KEY] = next
    }
    void router.replace({ query })
  }

  async function loadAll(options?: { force?: boolean }) {
    if (!canReadFlyers.value) {
      pending.value = false
      return
    }

    if (!options?.force) {
      const nuxtApp = useNuxtApp()
      const cachedFlyers = readNuxtPayloadCache(TENANT_FLYERS_CACHE_KEY, nuxtApp) as
        | TenantFlyerRow[]
        | undefined
      const cachedCategories = readNuxtPayloadCache(
        TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY,
        nuxtApp
      ) as TenantEmailTemplateCategoryRow[] | undefined
      if (Array.isArray(cachedFlyers) && Array.isArray(cachedCategories)) {
        flyers.value = cachedFlyers
        categories.value = cachedCategories
        pending.value = false
        loadError.value = ''
        return
      }
    }

    pending.value = true
    loadError.value = ''
    try {
      const [flyersRes, categoriesRes] = await Promise.all([
        flyerApi.fetchFlyers(),
        marketingApi.fetchEmailTemplateCategories()
      ])
      flyers.value = flyersRes.flyers ?? []
      categories.value = categoriesRes.categories ?? []
      const nuxtApp = useNuxtApp()
      nuxtApp.payload.data[TENANT_FLYERS_CACHE_KEY] = flyers.value
      nuxtApp.payload.data[TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY] = categories.value
    } catch (e: unknown) {
      loadError.value = resolveErrorMessage(e, 'Failed to load flyers')
      flyers.value = []
      categories.value = []
    } finally {
      pending.value = false
    }
  }

  function resetAddForm() {
    flyerName.value = ''
    selectedCategoryId.value = ''
    formError.value = ''
    setPendingFlyerFile(null)
  }

  function openAddModal() {
    if (!canAddFlyers.value || uploadPending.value) return
    resetAddForm()
    addModalOpen.value = true
  }

  function closeAddModal() {
    if (uploadPending.value) return
    addModalOpen.value = false
    resetAddForm()
  }

  function clearPendingFlyerFile() {
    setPendingFlyerFile(null)
    formError.value = ''
  }

  function onFlyerFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !canAddFlyers.value || uploadPending.value) return

    setPendingFlyerFile(file)
    formError.value = ''
  }

  async function submitFlyerUpload() {
    if (!canAddFlyers.value || uploadPending.value) return
    const file = pendingFlyerFile.value
    const name = normalizeFlyerName(flyerName.value).slice(0, FLYER_NAME_MAX_LENGTH)
    if (!file || !name) return

    const categoryId = selectedCategoryId.value || null
    formError.value = ''
    uploadingFlyerName.value = name
    uploadPending.value = true
    addModalOpen.value = false

    try {
      const dataUrl = await readFlyerFileAsDataUrl(file)
      await flyerApi.createFlyer({
        name,
        dataUrl,
        categoryId,
        originalFileName: file.name
      })
      toast.success('Flyer uploaded')
      clearNuxtPayloadCache(TENANT_FLYERS_CACHE_KEY)
      resetAddForm()
      await loadAll({ force: true })
    } catch (e: unknown) {
      const message = resolveErrorMessage(e, 'Could not upload flyer')
      toast.error(message)
      flyerName.value = name
      selectedCategoryId.value = categoryId ?? ''
      setPendingFlyerFile(file)
      addModalOpen.value = true
    } finally {
      uploadPending.value = false
      uploadingFlyerName.value = ''
    }
  }

  function openFlyerPreview(row: FlyerGroupItem) {
    previewFlyer.value = row
    previewOpen.value = true
  }

  function closeFlyerPreview() {
    previewOpen.value = false
    previewFlyer.value = null
  }

  function printFlyer(row: {
    id: string
    imageUrl: string
    name?: string
    contentType?: string
  }) {
    const ok = openFlyerForPrint({
      flyerId: row.id,
      url: row.imageUrl,
      name: row.name,
      contentType: row.contentType
    })
    if (!ok) {
      toast.error('Could not open the print dialog. Allow pop-ups and try again.')
    }
  }

  function requestDeleteFlyer(row: { id: string; name: string }) {
    if (!canDeleteFlyers.value || deleteConfirmLoading.value) return
    flyerToDelete.value = { id: row.id, name: row.name }
  }

  function cancelDeleteFlyer() {
    if (deleteConfirmLoading.value) return
    flyerToDelete.value = null
  }

  async function confirmDeleteFlyer() {
    const target = flyerToDelete.value
    if (!target || !canDeleteFlyers.value || deleteConfirmLoading.value) return

    deleteConfirmLoading.value = true
    try {
      await flyerApi.deleteFlyer(target.id)
      toast.success('Flyer deleted')
      flyerToDelete.value = null
      if (previewFlyer.value?.id === target.id) closeFlyerPreview()
      clearNuxtPayloadCache(TENANT_FLYERS_CACHE_KEY)
      await loadAll({ force: true })
    } catch (e: unknown) {
      toast.error(resolveErrorMessage(e, 'Failed to delete flyer'))
    } finally {
      deleteConfirmLoading.value = false
    }
  }

  function resolveErrorMessage(e: unknown, fallback: string): string {
    if (e && typeof e === 'object' && 'data' in e) {
      const message = (e as { data?: { message?: string } }).data?.message
      if (message) return String(message)
    }
    if (e instanceof Error && e.message) return e.message
    return fallback
  }

  return {
    canReadFlyers,
    canAddFlyers,
    canDeleteFlyers,
    pending,
    uploadPending,
    uploadingFlyerName,
    busy,
    addModalOpen,
    previewOpen,
    previewFlyer,
    loadError,
    formError,
    flyers,
    categories,
    flyerName,
    selectedCategoryId,
    pendingFlyerFileName,
    pendingFlyerContentType,
    pendingFlyerSizeLabel,
    pendingFlyerPreviewUrl,
    canSubmitFlyer,
    categoryFilter,
    categoryFilterOptions,
    categoryAssignOptions,
    categoryGroups,
    filteredFlyers,
    categoriesManagePath: EMAIL_TEMPLATE_CATEGORIES_MANAGE_PATH,
    setCategoryFilter,
    loadAll,
    openAddModal,
    closeAddModal,
    clearPendingFlyerFile,
    onFlyerFileChange,
    submitFlyerUpload,
    openFlyerPreview,
    closeFlyerPreview,
    printFlyer,
    flyerToDelete,
    deleteModalMessage,
    deleteConfirmLoading,
    flyerDeleteConfirmTitle: FLYER_DELETE_CONFIRM_TITLE,
    flyerDeleteConfirmText: FLYER_DELETE_CONFIRM_TEXT,
    requestDeleteFlyer,
    cancelDeleteFlyer,
    confirmDeleteFlyer
  }
}
