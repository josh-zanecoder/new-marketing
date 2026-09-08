import type { TenantEmailTemplateCategoryRow, TenantEmailTemplateRow } from '~/composables/useTenantMarketingApi'
import {
  EMAIL_TEMPLATE_CATEGORY_FILTER_ALL,
  EMAIL_TEMPLATE_CATEGORY_QUERY_KEY
} from '~~/shared/constants/emailTemplateCategory'
import {
  buildEmailTemplateCategoryFilterOptions,
  matchesEmailTemplateCategoryFilter,
  parseEmailTemplateCategoryFilterQuery,
  type EmailTemplateCategoryFilterValue
} from '~~/shared/utils/emailTemplateCategory'

type EmailTemplateListRow = TenantEmailTemplateRow & {
  description?: string
  createdAt?: string | null
  updatedAt?: string | null
}

type SortOption = 'recent' | 'name-asc' | 'name-desc'
type SubjectFilter = 'all' | 'with-subject' | 'without-subject'

const PAGE_SIZE = 12

export function useEmailTemplatesPage() {
  const route = useRoute()
  const marketingApi = useTenantMarketingApi()
  const toast = useAppToast()

  const pending = ref(true)
  const deletingId = ref('')
  const loadError = ref('')
  const templates = ref<EmailTemplateListRow[]>([])
  const categories = ref<TenantEmailTemplateCategoryRow[]>([])
  const searchQuery = ref('')
  const sortBy = ref<SortOption>('recent')
  const subjectFilter = ref<SubjectFilter>('all')
  const categoryFilter = ref<EmailTemplateCategoryFilterValue>(
    parseEmailTemplateCategoryFilterQuery(route.query[EMAIL_TEMPLATE_CATEGORY_QUERY_KEY])
  )
  const currentPage = ref(1)

  const previewOpen = ref(false)
  const previewTemplate = ref<EmailTemplateListRow | null>(null)

  const EMAIL_TEMPLATES_CACHE_KEY = TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY

  const subjectFilterSelectOptions = [
    { value: 'all', label: 'All templates' },
    { value: 'with-subject', label: 'With default subject' },
    { value: 'without-subject', label: 'Without subject' }
  ]

  const categoryFilterSelectOptions = computed(() =>
    buildEmailTemplateCategoryFilterOptions(
      categories.value.map((c) => ({ id: c.id, name: c.name }))
    )
  )

  const sortBySelectOptions = [
    { value: 'recent', label: 'Recently updated' },
    { value: 'name-asc', label: 'Name A–Z' },
    { value: 'name-desc', label: 'Name Z–A' }
  ]

  function formatUpdated(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  const filteredTemplates = computed(() => {
    let list = [...templates.value]
    const subject = subjectFilter.value
    if (subject === 'with-subject') {
      list = list.filter((t) => Boolean(t.subject?.trim()))
    } else if (subject === 'without-subject') {
      list = list.filter((t) => !t.subject?.trim())
    }
    list = list.filter((t) => matchesEmailTemplateCategoryFilter(t.categoryId, categoryFilter.value))
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      list = list.filter((t) => {
        const blob = [t.name, t.subject, t.description, t.categoryName].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(q)
      })
    }
    if (sortBy.value === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy.value === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name))
    } else {
      list.sort((a, b) => {
        const aMs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bMs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bMs - aMs
      })
    }
    return list
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filteredTemplates.value.length / PAGE_SIZE))
  )

  const paginatedTemplates = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE
    return filteredTemplates.value.slice(start, start + PAGE_SIZE)
  })

  const paginationMeta = computed(() => {
    const total = filteredTemplates.value.length
    if (!total) return { from: 0, to: 0, total: 0 }
    const from = (currentPage.value - 1) * PAGE_SIZE + 1
    const to = Math.min(currentPage.value * PAGE_SIZE, total)
    return { from, to, total }
  })

  watch([searchQuery, sortBy, subjectFilter, categoryFilter], () => {
    currentPage.value = 1
  })

  watch(totalPages, (pages) => {
    if (currentPage.value > pages) currentPage.value = pages
  })

  watch(
    () => route.query[EMAIL_TEMPLATE_CATEGORY_QUERY_KEY],
    (raw) => {
      const next = parseEmailTemplateCategoryFilterQuery(raw)
      if (next !== categoryFilter.value) categoryFilter.value = next
    }
  )

  watch(categoryFilter, (value) => {
    const fromRoute = parseEmailTemplateCategoryFilterQuery(
      route.query[EMAIL_TEMPLATE_CATEGORY_QUERY_KEY]
    )
    if (fromRoute === value) return
    const query =
      value === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
        ? Object.fromEntries(
            Object.entries(route.query).filter(
              ([key]) => key !== EMAIL_TEMPLATE_CATEGORY_QUERY_KEY
            )
          )
        : { ...route.query, [EMAIL_TEMPLATE_CATEGORY_QUERY_KEY]: value }
    void navigateTo({ path: route.path, query }, { replace: true })
  })

  function makeCampaignHref(templateId: string): string {
    return `/tenant/campaigns/add?templateId=${encodeURIComponent(templateId)}`
  }

  function editTemplateHref(templateId: string): string {
    return `/tenant/email-templates/add?templateId=${encodeURIComponent(templateId)}`
  }

  function applyCategoryFilter(categoryId: string | null | undefined) {
    const id = typeof categoryId === 'string' ? categoryId.trim() : ''
    categoryFilter.value = id || EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
  }

  function openPreview(template: EmailTemplateListRow) {
    previewTemplate.value = template
    previewOpen.value = true
  }

  function closePreview() {
    previewOpen.value = false
    previewTemplate.value = null
  }

  async function loadCategories() {
    try {
      const cached = readNuxtPayloadCache(TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY, useNuxtApp()) as
        | TenantEmailTemplateCategoryRow[]
        | undefined
      if (Array.isArray(cached)) {
        categories.value = cached
        return
      }
      const res = await marketingApi.fetchEmailTemplateCategories()
      categories.value = res.categories ?? []
      useNuxtApp().payload.data[TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY] = categories.value
    } catch {
      categories.value = []
    }
  }

  async function loadTemplates(options?: { force?: boolean }) {
    if (!options?.force) {
      const cached = readNuxtPayloadCache(EMAIL_TEMPLATES_CACHE_KEY, useNuxtApp()) as
        | EmailTemplateListRow[]
        | undefined
      if (Array.isArray(cached)) {
        templates.value = cached
        pending.value = false
        loadError.value = ''
        return
      }
    }

    pending.value = true
    loadError.value = ''
    try {
      const res = await marketingApi.fetchEmailTemplates()
      templates.value = (res.templates ?? []) as EmailTemplateListRow[]
      useNuxtApp().payload.data[EMAIL_TEMPLATES_CACHE_KEY] = templates.value
    } catch (e: unknown) {
      loadError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load templates')
          : 'Failed to load templates'
      templates.value = []
    } finally {
      pending.value = false
    }
  }

  const templateToDelete = ref<EmailTemplateListRow | null>(null)
  const deleteConfirmLoading = ref(false)

  const deleteModalMessage = computed(() => {
    const name = templateToDelete.value?.name?.trim() || 'this template'
    return `Delete “${name}”? It will be removed from the library. Existing campaigns that already use it are unaffected.`
  })

  function openDeleteModal(template: EmailTemplateListRow) {
    templateToDelete.value = template
  }

  function cancelDeleteModal() {
    if (deleteConfirmLoading.value) return
    templateToDelete.value = null
  }

  async function confirmDeleteTemplate() {
    const template = templateToDelete.value
    if (!template || deleteConfirmLoading.value) return

    deleteConfirmLoading.value = true
    deletingId.value = template.id
    try {
      await marketingApi.deleteEmailTemplate(template.id)
      toast.success('Template deleted')
      if (previewTemplate.value?.id === template.id) closePreview()
      templateToDelete.value = null
      clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
      await loadTemplates({ force: true })
    } catch (e: unknown) {
      toast.error(
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to delete template')
          : 'Failed to delete template'
      )
    } finally {
      deletingId.value = ''
      deleteConfirmLoading.value = false
    }
  }

  function onMountedLoad() {
    void loadCategories()
    void loadTemplates()
  }

  return {
    PAGE_SIZE,
    pending,
    deletingId,
    loadError,
    templates,
    categories,
    searchQuery,
    sortBy,
    subjectFilter,
    categoryFilter,
    currentPage,
    previewOpen,
    previewTemplate,
    templateToDelete,
    deleteConfirmLoading,
    deleteModalMessage,
    subjectFilterSelectOptions,
    categoryFilterSelectOptions,
    sortBySelectOptions,
    filteredTemplates,
    totalPages,
    paginatedTemplates,
    paginationMeta,
    formatUpdated,
    makeCampaignHref,
    editTemplateHref,
    applyCategoryFilter,
    openPreview,
    closePreview,
    loadTemplates,
    openDeleteModal,
    cancelDeleteModal,
    confirmDeleteTemplate,
    onMountedLoad
  }
}
