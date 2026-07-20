import type { TenantEmailTemplateCategoryRow } from '~/composables/useTenantMarketingApi'
import { normalizeEmailTemplateCategoryName } from '~~/shared/utils/emailTemplateCategory'

export function useEmailTemplateCategoriesPage() {
  const marketingApi = useTenantMarketingApi()
  const toast = useAppToast()

  const pending = ref(true)
  const saving = ref(false)
  const loadError = ref('')
  const formError = ref('')
  const categories = ref<TenantEmailTemplateCategoryRow[]>([])
  const searchQuery = ref('')

  const name = ref('')
  const description = ref('')
  const editingId = ref('')

  const isEditing = computed(() => Boolean(editingId.value))

  const filteredCategories = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const list = [...categories.value]
    if (!q) return list
    return list.filter((c) => {
      const blob = [c.name, c.description].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  })

  function resetForm() {
    name.value = ''
    description.value = ''
    editingId.value = ''
    formError.value = ''
  }

  function startEdit(row: TenantEmailTemplateCategoryRow) {
    editingId.value = row.id
    name.value = row.name
    description.value = row.description ?? ''
    formError.value = ''
  }

  async function loadCategories(options?: { force?: boolean }) {
    if (!options?.force) {
      const cached = readNuxtPayloadCache(TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY, useNuxtApp()) as
        | TenantEmailTemplateCategoryRow[]
        | undefined
      if (Array.isArray(cached)) {
        categories.value = cached
        pending.value = false
        loadError.value = ''
        return
      }
    }

    pending.value = true
    loadError.value = ''
    try {
      const res = await marketingApi.fetchEmailTemplateCategories()
      categories.value = res.categories ?? []
      useNuxtApp().payload.data[TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY] = categories.value
    } catch (e: unknown) {
      loadError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load categories')
          : 'Failed to load categories'
      categories.value = []
    } finally {
      pending.value = false
    }
  }

  async function saveCategory() {
    formError.value = ''
    const trimmedName = normalizeEmailTemplateCategoryName(name.value)
    if (!trimmedName) {
      formError.value = 'Category name is required.'
      return
    }

    saving.value = true
    try {
      if (isEditing.value) {
        await marketingApi.updateEmailTemplateCategory(editingId.value, {
          name: trimmedName,
          description: description.value.trim()
        })
        toast.success('Category updated')
      } else {
        await marketingApi.createEmailTemplateCategory({
          name: trimmedName,
          description: description.value.trim()
        })
        toast.success('Category created')
      }
      clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY)
      clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
      resetForm()
      await loadCategories({ force: true })
    } catch (e: unknown) {
      formError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to save category')
          : 'Failed to save category'
    } finally {
      saving.value = false
    }
  }

  async function removeCategory(row: TenantEmailTemplateCategoryRow) {
    if (!import.meta.client) return
    const ok = window.confirm(
      `Delete category “${row.name}”? Templates using it will become uncategorized.`
    )
    if (!ok) return

    try {
      await marketingApi.deleteEmailTemplateCategory(row.id)
      toast.success('Category deleted')
      if (editingId.value === row.id) resetForm()
      clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATE_CATEGORIES_CACHE_KEY)
      clearNuxtPayloadCache(TENANT_EMAIL_TEMPLATES_INDEX_CACHE_KEY)
      await loadCategories({ force: true })
    } catch (e: unknown) {
      toast.error(
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to delete category')
          : 'Failed to delete category'
      )
    }
  }

  function formatUpdated(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  return {
    pending,
    saving,
    loadError,
    formError,
    categories,
    searchQuery,
    name,
    description,
    editingId,
    isEditing,
    filteredCategories,
    resetForm,
    startEdit,
    loadCategories,
    saveCategory,
    removeCategory,
    formatUpdated
  }
}
