import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  buildAdminDeletedFlyerHardDeleteMessage,
  buildAdminDeletedFlyerRecoverMessage,
  ADMIN_DELETED_FLYERS_HARD_DELETE_CONFIRM,
  ADMIN_DELETED_FLYERS_HARD_DELETE_TITLE,
  ADMIN_DELETED_FLYERS_RECOVER_CONFIRM,
  ADMIN_DELETED_FLYERS_RECOVER_TITLE
} from '~~/shared/constants/adminDeletedFlyersCopy'
import { buildAdminFlyerFileUrl } from '~~/shared/utils/flyerFileUrl'
import type { FlyerGroupItem } from '~~/shared/utils/groupFlyersByCategory'

export type AdminDeletedFlyerRow = FlyerGroupItem & {
  objectPath?: string
  size?: number
  updatedAt?: string | null
  deletedAt: string | null
}

export function useAdminDeletedFlyers(tenantId: Ref<string | null | undefined>) {
  const toast = useAppToast()

  const pending = ref(false)
  const loadError = ref('')
  const flyers = ref<AdminDeletedFlyerRow[]>([])
  const flyerToHardDelete = ref<AdminDeletedFlyerRow | null>(null)
  const flyerToRecover = ref<AdminDeletedFlyerRow | null>(null)
  const hardDeleteLoading = ref(false)
  const recoverLoading = ref(false)
  const busyId = ref('')
  const previewOpen = ref(false)
  const previewFlyer = ref<AdminDeletedFlyerRow | null>(null)

  const hardDeleteModalMessage = computed(() =>
    buildAdminDeletedFlyerHardDeleteMessage(flyerToHardDelete.value?.name || '')
  )
  const recoverModalMessage = computed(() =>
    buildAdminDeletedFlyerRecoverMessage(flyerToRecover.value?.name || '')
  )

  const previewFileUrl = computed(() => {
    const tid = tenantId.value?.trim() || ''
    const id = previewFlyer.value?.id?.trim() || ''
    return buildAdminFlyerFileUrl(tid, id)
  })

  function apiPrefix(): string | null {
    const id = tenantId.value?.trim()
    if (!id) return null
    return `/api/v1/admin/tenants/${encodeURIComponent(id)}`
  }

  function adminFileUrlFor(flyerId: string): string {
    const tid = tenantId.value?.trim() || ''
    return buildAdminFlyerFileUrl(tid, flyerId)
  }

  function formatDeletedAt(iso?: string | null): string {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  function openPreview(flyer: AdminDeletedFlyerRow) {
    previewFlyer.value = flyer
    previewOpen.value = true
  }

  function closePreview() {
    previewOpen.value = false
    previewFlyer.value = null
  }

  async function loadDeletedFlyers() {
    const prefix = apiPrefix()
    if (!prefix) {
      flyers.value = []
      loadError.value = ''
      return
    }

    pending.value = true
    loadError.value = ''
    try {
      const res = await $fetch<{ flyers: AdminDeletedFlyerRow[] }>(`${prefix}/flyers/deleted`)
      flyers.value = res.flyers ?? []
    } catch (e: unknown) {
      loadError.value = fetchErrorMessage(e, 'Failed to load deleted flyers')
      flyers.value = []
    } finally {
      pending.value = false
    }
  }

  function openHardDeleteModal(row: AdminDeletedFlyerRow) {
    flyerToHardDelete.value = row
  }

  function cancelHardDeleteModal() {
    if (hardDeleteLoading.value) return
    flyerToHardDelete.value = null
  }

  function openRecoverModal(row: AdminDeletedFlyerRow) {
    flyerToRecover.value = row
  }

  function cancelRecoverModal() {
    if (recoverLoading.value) return
    flyerToRecover.value = null
  }

  async function confirmHardDelete() {
    const row = flyerToHardDelete.value
    const prefix = apiPrefix()
    if (!row || !prefix || hardDeleteLoading.value) return

    hardDeleteLoading.value = true
    busyId.value = row.id
    try {
      await $fetch(`${prefix}/flyers/${encodeURIComponent(row.id)}`, {
        method: 'DELETE'
      })
      toast.success('Flyer deleted forever')
      if (previewFlyer.value?.id === row.id) closePreview()
      flyerToHardDelete.value = null
      await loadDeletedFlyers()
    } catch (e: unknown) {
      toast.error(fetchErrorMessage(e, 'Failed to delete flyer forever'))
    } finally {
      busyId.value = ''
      hardDeleteLoading.value = false
    }
  }

  async function confirmRecover() {
    const row = flyerToRecover.value
    const prefix = apiPrefix()
    if (!row || !prefix || recoverLoading.value) return

    recoverLoading.value = true
    busyId.value = row.id
    try {
      await $fetch(`${prefix}/flyers/${encodeURIComponent(row.id)}/recover`, {
        method: 'POST'
      })
      toast.success('Flyer recovered')
      if (previewFlyer.value?.id === row.id) closePreview()
      flyerToRecover.value = null
      await loadDeletedFlyers()
    } catch (e: unknown) {
      toast.error(fetchErrorMessage(e, 'Failed to recover flyer'))
    } finally {
      busyId.value = ''
      recoverLoading.value = false
    }
  }

  watch(
    tenantId,
    (id) => {
      if (id) void loadDeletedFlyers()
      else {
        flyers.value = []
        loadError.value = ''
      }
    },
    { immediate: true }
  )

  return {
    pending,
    loadError,
    flyers,
    flyerToHardDelete,
    flyerToRecover,
    hardDeleteLoading,
    recoverLoading,
    busyId,
    previewOpen,
    previewFlyer,
    previewFileUrl,
    hardDeleteModalMessage,
    recoverModalMessage,
    recoverTitle: ADMIN_DELETED_FLYERS_RECOVER_TITLE,
    recoverConfirmText: ADMIN_DELETED_FLYERS_RECOVER_CONFIRM,
    hardDeleteTitle: ADMIN_DELETED_FLYERS_HARD_DELETE_TITLE,
    hardDeleteConfirmText: ADMIN_DELETED_FLYERS_HARD_DELETE_CONFIRM,
    formatDeletedAt,
    adminFileUrlFor,
    openPreview,
    closePreview,
    loadDeletedFlyers,
    openHardDeleteModal,
    cancelHardDeleteModal,
    confirmHardDelete,
    openRecoverModal,
    cancelRecoverModal,
    confirmRecover
  }
}
