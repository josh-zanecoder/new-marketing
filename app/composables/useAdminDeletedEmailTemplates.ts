import { fetchErrorMessage } from '~/utils/fetchErrorMessage'

export type AdminDeletedEmailTemplateRow = {
  id: string
  name: string
  description: string
  subject: string
  externalId: string
  categoryId: string | null
  categoryName: string | null
  htmlTemplate: string
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
}

export function useAdminDeletedEmailTemplates(tenantId: Ref<string | null | undefined>) {
  const toast = useAppToast()

  const pending = ref(false)
  const loadError = ref('')
  const templates = ref<AdminDeletedEmailTemplateRow[]>([])
  const templateToHardDelete = ref<AdminDeletedEmailTemplateRow | null>(null)
  const templateToRecover = ref<AdminDeletedEmailTemplateRow | null>(null)
  const hardDeleteLoading = ref(false)
  const recoverLoading = ref(false)
  const busyId = ref('')
  const previewOpen = ref(false)
  const previewTemplate = ref<AdminDeletedEmailTemplateRow | null>(null)

  const hardDeleteModalMessage = computed(() => {
    const name = templateToHardDelete.value?.name?.trim() || 'this template'
    return `Delete “${name}” forever? This cannot be undone. Campaigns that linked this template will lose the link.`
  })

  const recoverModalMessage = computed(() => {
    const name = templateToRecover.value?.name?.trim() || 'this template'
    return `Recover “${name}”? It will return to the tenant email template library.`
  })

  function apiPrefix(): string | null {
    const id = tenantId.value?.trim()
    if (!id) return null
    return `/api/v1/admin/tenants/${encodeURIComponent(id)}`
  }

  function formatDeletedAt(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  function openPreview(template: AdminDeletedEmailTemplateRow) {
    previewTemplate.value = template
    previewOpen.value = true
  }

  function closePreview() {
    previewOpen.value = false
    previewTemplate.value = null
  }

  async function loadDeletedTemplates() {
    const prefix = apiPrefix()
    if (!prefix) {
      templates.value = []
      loadError.value = ''
      return
    }

    pending.value = true
    loadError.value = ''
    try {
      const res = await $fetch<{ templates: AdminDeletedEmailTemplateRow[] }>(
        `${prefix}/email-templates/deleted`
      )
      templates.value = (res.templates ?? []).map((t) => ({
        ...t,
        htmlTemplate: t.htmlTemplate ?? ''
      }))
    } catch (e: unknown) {
      loadError.value = fetchErrorMessage(e, 'Failed to load deleted templates')
      templates.value = []
    } finally {
      pending.value = false
    }
  }

  function openHardDeleteModal(row: AdminDeletedEmailTemplateRow) {
    templateToHardDelete.value = row
  }

  function cancelHardDeleteModal() {
    if (hardDeleteLoading.value) return
    templateToHardDelete.value = null
  }

  function openRecoverModal(row: AdminDeletedEmailTemplateRow) {
    templateToRecover.value = row
  }

  function cancelRecoverModal() {
    if (recoverLoading.value) return
    templateToRecover.value = null
  }

  async function confirmHardDelete() {
    const row = templateToHardDelete.value
    const prefix = apiPrefix()
    if (!row || !prefix || hardDeleteLoading.value) return

    hardDeleteLoading.value = true
    busyId.value = row.id
    try {
      await $fetch(`${prefix}/email-templates/${encodeURIComponent(row.id)}`, {
        method: 'DELETE'
      })
      toast.success('Template deleted forever')
      if (previewTemplate.value?.id === row.id) closePreview()
      templateToHardDelete.value = null
      await loadDeletedTemplates()
    } catch (e: unknown) {
      toast.error(fetchErrorMessage(e, 'Failed to delete template forever'))
    } finally {
      busyId.value = ''
      hardDeleteLoading.value = false
    }
  }

  async function confirmRecover() {
    const row = templateToRecover.value
    const prefix = apiPrefix()
    if (!row || !prefix || recoverLoading.value) return

    recoverLoading.value = true
    busyId.value = row.id
    try {
      await $fetch(`${prefix}/email-templates/${encodeURIComponent(row.id)}/recover`, {
        method: 'POST'
      })
      toast.success('Template recovered')
      if (previewTemplate.value?.id === row.id) closePreview()
      templateToRecover.value = null
      await loadDeletedTemplates()
    } catch (e: unknown) {
      toast.error(fetchErrorMessage(e, 'Failed to recover template'))
    } finally {
      busyId.value = ''
      recoverLoading.value = false
    }
  }

  watch(
    tenantId,
    (id) => {
      if (id) void loadDeletedTemplates()
      else {
        templates.value = []
        loadError.value = ''
      }
    },
    { immediate: true }
  )

  return {
    pending,
    loadError,
    templates,
    templateToHardDelete,
    templateToRecover,
    hardDeleteLoading,
    recoverLoading,
    busyId,
    previewOpen,
    previewTemplate,
    hardDeleteModalMessage,
    recoverModalMessage,
    formatDeletedAt,
    openPreview,
    closePreview,
    loadDeletedTemplates,
    openHardDeleteModal,
    cancelHardDeleteModal,
    confirmHardDelete,
    openRecoverModal,
    cancelRecoverModal,
    confirmRecover
  }
}
