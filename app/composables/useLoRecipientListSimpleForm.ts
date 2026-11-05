/**
 * Simplified recipient-list create/edit when `allowTenantLoRecipientLists` is ON.
 * Classic form stays in useRecipientListForm — this path does not touch it.
 */
import type { MaybeRefOrGetter } from 'vue'
import { toValue, watch } from 'vue'
import {
  clearNuxtPayloadCache,
  TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY
} from '~/composables/useNuxtPayloadCache'
import { loadAllLoBorrowerPages } from '~~/shared/loBorrowersPreviewPage'

/** Rows per page in the LO borrowers checklist UI. */
export const LO_BORROWERS_CHECKLIST_PAGE_SIZE = 10

export type LoBorrowerPreviewRow = {
  id: string
  name: string
  email: string
}

export function useLoRecipientListSimpleForm(options: {
  mode: 'create' | 'edit'
  listId?: MaybeRefOrGetter<string>
}) {
  const { serverAuthHeaders } = useTenantMarketingApi()
  const {
    allowTenantLoRecipientLists,
    isSelfOnlyAudience,
    sessionUser,
    senderDisplayName,
    loadDefaultCampaignSender,
    loaded: flagLoaded
  } = useDefaultCampaignSender()
  void loadDefaultCampaignSender()

  const loadPending = ref(true)
  const loadError = ref('')
  const saveError = ref('')
  const saving = ref(false)

  const form = reactive({
    name: '',
    associatedLoanOfficerEmail: '',
    associatedLoanOfficerName: ''
  })

  const borrowers = ref<LoBorrowerPreviewRow[]>([])
  const borrowerTotal = ref(0)
  const borrowersLoading = ref(false)
  /** True while later pages stream in after the first page is already shown. */
  const borrowersLoadingMore = ref(false)
  /** Progressive load hint: unique rows loaded so far vs server total hint. */
  const borrowersLoadProgress = ref<{ loaded: number; totalHint: number }>({
    loaded: 0,
    totalHint: 0
  })
  const borrowersError = ref('')
  /** Contact id → included in list (default true). */
  const borrowerChecked = reactive<Record<string, boolean>>({})
  /** Exclusions outside the current preview page (edit hydrate). */
  const excludedOutsidePreview = ref<string[]>([])
  /** Client-side filter for the LO borrowers checklist. */
  const borrowerSearchQ = ref('')
  /** 1-based page within filtered borrowers. */
  const borrowerPage = ref(1)

  let previewSeq = 0

  const filteredBorrowers = computed(() => {
    const q = borrowerSearchQ.value.trim().toLowerCase()
    if (!q) return borrowers.value
    return borrowers.value.filter((b) => {
      const name = b.name.trim().toLowerCase()
      const email = b.email.trim().toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  })

  const borrowerPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredBorrowers.value.length / LO_BORROWERS_CHECKLIST_PAGE_SIZE))
  )

  const pagedBorrowers = computed(() => {
    const page = Math.min(Math.max(1, borrowerPage.value), borrowerPageCount.value)
    const start = (page - 1) * LO_BORROWERS_CHECKLIST_PAGE_SIZE
    return filteredBorrowers.value.slice(start, start + LO_BORROWERS_CHECKLIST_PAGE_SIZE)
  })

  const borrowerPageMeta = computed(() => {
    const total = filteredBorrowers.value.length
    if (!total) return { from: 0, to: 0, total: 0, page: 1, pageCount: 1 }
    const page = Math.min(Math.max(1, borrowerPage.value), borrowerPageCount.value)
    const from = (page - 1) * LO_BORROWERS_CHECKLIST_PAGE_SIZE + 1
    const to = Math.min(page * LO_BORROWERS_CHECKLIST_PAGE_SIZE, total)
    return { from, to, total, page, pageCount: borrowerPageCount.value }
  })

  const canGoBorrowerPrev = computed(() => borrowerPageMeta.value.page > 1)
  const canGoBorrowerNext = computed(
    () => borrowerPageMeta.value.page < borrowerPageMeta.value.pageCount
  )

  function goBorrowerPrev() {
    if (!canGoBorrowerPrev.value) return
    borrowerPage.value -= 1
  }

  function goBorrowerNext() {
    if (!canGoBorrowerNext.value) return
    borrowerPage.value += 1
  }

  watch(borrowerSearchQ, () => {
    borrowerPage.value = 1
  })

  watch(filteredBorrowers, (rows) => {
    const maxPage = Math.max(1, Math.ceil(rows.length / LO_BORROWERS_CHECKLIST_PAGE_SIZE))
    if (borrowerPage.value > maxPage) borrowerPage.value = maxPage
  })

  const uncheckedBorrowerIds = computed(() =>
    borrowers.value.filter((b) => borrowerChecked[b.id] === false).map((b) => b.id)
  )

  const checkedBorrowerCount = computed(
    () => borrowers.value.filter((b) => borrowerChecked[b.id] !== false).length
  )

  const allBorrowersChecked = computed(
    () =>
      borrowers.value.length > 0 &&
      borrowers.value.every((b) => borrowerChecked[b.id] !== false)
  )

  const noBorrowersChecked = computed(
    () =>
      borrowers.value.length > 0 &&
      borrowers.value.every((b) => borrowerChecked[b.id] === false)
  )

  const submitBlockReasons = computed((): string[] => {
    const reasons: string[] = []
    if (!form.name.trim()) reasons.push('Enter a list name.')
    if (!form.associatedLoanOfficerEmail.trim()) {
      reasons.push('Select a loan officer email.')
    }
    if (borrowers.value.length > 0 && uncheckedBorrowerIds.value.length === borrowers.value.length) {
      reasons.push('Select at least one borrower.')
    }
    return reasons
  })

  const canSubmitForm = computed(() => submitBlockReasons.value.length === 0)

  function resetBorrowerChecks(rows: LoBorrowerPreviewRow[], defaultUncheckedIds?: Set<string>) {
    for (const key of Object.keys(borrowerChecked)) {
      delete borrowerChecked[key]
    }
    for (const row of rows) {
      borrowerChecked[row.id] = defaultUncheckedIds ? !defaultUncheckedIds.has(row.id) : true
    }
  }

  /** Preserve user toggles while progressive pages append new borrowers. */
  function mergeBorrowerChecks(rows: LoBorrowerPreviewRow[], defaultUncheckedIds?: Set<string>) {
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(borrowerChecked, row.id)) continue
      borrowerChecked[row.id] = defaultUncheckedIds ? !defaultUncheckedIds.has(row.id) : true
    }
  }

  function setBorrowerChecked(id: string, checked: boolean) {
    borrowerChecked[id] = checked
  }

  function checkAllBorrowers() {
    for (const row of borrowers.value) {
      borrowerChecked[row.id] = true
    }
  }

  function uncheckAllBorrowers() {
    for (const row of borrowers.value) {
      borrowerChecked[row.id] = false
    }
  }

  /** One control: uncheck when all selected, otherwise check all. */
  function toggleAllBorrowers() {
    if (allBorrowersChecked.value) uncheckAllBorrowers()
    else checkAllBorrowers()
  }

  const toggleAllBorrowersLabel = computed(() =>
    allBorrowersChecked.value ? 'Uncheck all' : 'Check all'
  )

  function onLoanOfficerSelect(c: { email: string; displayName: string }) {
    if (isSelfOnlyAudience.value) return
    form.associatedLoanOfficerEmail = c.email
    form.associatedLoanOfficerName = c.displayName || c.email
    excludedOutsidePreview.value = []
    borrowerSearchQ.value = ''
    borrowerPage.value = 1
    void loadBorrowers()
  }

  function onLoanOfficerTyped() {
    if (isSelfOnlyAudience.value) return
    form.associatedLoanOfficerName = ''
    borrowers.value = []
    borrowerTotal.value = 0
    excludedOutsidePreview.value = []
    borrowerSearchQ.value = ''
    borrowerPage.value = 1
    resetBorrowerChecks([])
  }

  /** LO/LOA: lock associated officer to the signed-in user and load their borrowers. */
  function applySelfLoanOfficer() {
    if (!isSelfOnlyAudience.value) return
    const email = String(sessionUser.value?.email || '')
      .trim()
      .toLowerCase()
    if (!email.includes('@')) return
    form.associatedLoanOfficerEmail = email
    form.associatedLoanOfficerName = senderDisplayName.value || email
    void loadBorrowers()
  }

  async function loadBorrowers(opts?: { uncheckedIds?: Set<string> }) {
    const email = form.associatedLoanOfficerEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      borrowers.value = []
      borrowerTotal.value = 0
      borrowersLoadProgress.value = { loaded: 0, totalHint: 0 }
      borrowersLoadingMore.value = false
      resetBorrowerChecks([])
      return
    }
    const seq = ++previewSeq
    borrowersLoading.value = true
    borrowersLoadingMore.value = false
    borrowersError.value = ''
    borrowers.value = []
    borrowerTotal.value = 0
    borrowersLoadProgress.value = { loaded: 0, totalHint: 0 }
    resetBorrowerChecks([])
    borrowerPage.value = 1
    try {
      // Progressive: paint first page ASAP, keep paging in the background.
      const loaded = await loadAllLoBorrowerPages({
        fetchPage: async ({ skip, limit }) => {
          if (seq !== previewSeq) {
            return { total: 0, borrowers: [] }
          }
          return await $fetch<{
            total: number
            borrowers: LoBorrowerPreviewRow[]
          }>('/api/v1/tenant/recipient-list/lo-borrowers', {
            credentials: 'include',
            ...serverAuthHeaders(),
            query: {
              ownerEmail: email,
              limit,
              skip
            }
          })
        },
        onPage: async ({ accumulated, totalHint, done, pageIndex }) => {
          if (seq !== previewSeq) return
          const dedupedSoFar = accumulated
          borrowers.value = dedupedSoFar
          borrowerTotal.value = Math.max(dedupedSoFar.length, totalHint)
          borrowersLoadProgress.value = {
            loaded: dedupedSoFar.length,
            totalHint: Math.max(dedupedSoFar.length, totalHint)
          }
          if (pageIndex === 0) {
            resetBorrowerChecks(dedupedSoFar, opts?.uncheckedIds)
            borrowersLoading.value = false
            borrowersLoadingMore.value = !done
          } else {
            mergeBorrowerChecks(dedupedSoFar, opts?.uncheckedIds)
            borrowersLoadingMore.value = !done
          }
        }
      })
      if (seq !== previewSeq) return
      const allRows = loaded.borrowers
      borrowers.value = allRows
      borrowerTotal.value = loaded.total
      borrowersLoadProgress.value = { loaded: allRows.length, totalHint: allRows.length }
      mergeBorrowerChecks(allRows, opts?.uncheckedIds)
      if (opts?.uncheckedIds) {
        const previewIds = new Set(allRows.map((r) => r.id))
        excludedOutsidePreview.value = [...opts.uncheckedIds].filter((id) => !previewIds.has(id))
      } else {
        excludedOutsidePreview.value = []
      }
    } catch (e: unknown) {
      if (seq !== previewSeq) return
      borrowers.value = []
      borrowerTotal.value = 0
      borrowersLoadProgress.value = { loaded: 0, totalHint: 0 }
      resetBorrowerChecks([])
      borrowersError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load borrowers')
          : 'Failed to load borrowers'
    } finally {
      if (seq === previewSeq) {
        borrowersLoading.value = false
        borrowersLoadingMore.value = false
      }
    }
  }

  function buildSaveBody(): Record<string, unknown> {
    const uncheckedRows = borrowers.value.filter((b) => borrowerChecked[b.id] === false)
    const excludedContactIds = [
      ...excludedOutsidePreview.value,
      ...uncheckedRows.map((b) => b.id)
    ]
    const excludedContactEmails = uncheckedRows
      .map((b) => b.email.trim().toLowerCase())
      .filter((email) => email.includes('@'))
    return {
      name: form.name.trim(),
      audience: 'borrower',
      filterMode: 'and',
      filterRows: [],
      associatedLoanOfficerEmail: form.associatedLoanOfficerEmail.trim().toLowerCase(),
      associatedLoanOfficerName: form.associatedLoanOfficerName.trim(),
      excludedContactIds,
      excludedContactEmails
    }
  }

  function fetchErrorMessage(e: unknown, fallback: string): string {
    return e && typeof e === 'object' && 'data' in e
      ? String((e as { data?: { message?: string } }).data?.message ?? fallback)
      : fallback
  }

  async function submitCreate(): Promise<void> {
    saveError.value = ''
    if (!canSubmitForm.value) return
    saving.value = true
    try {
      const created = await $fetch<{ list?: { id?: string } }>('/api/v1/tenant/recipient-list', {
        method: 'POST',
        credentials: 'include',
        ...serverAuthHeaders(),
        body: buildSaveBody()
      })
      clearNuxtPayloadCache(TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY)
      const newId = typeof created?.list?.id === 'string' ? created.list.id.trim() : ''
      if (newId) {
        await navigateTo(`/tenant/recipient-list/${encodeURIComponent(newId)}`)
        return
      }
      await navigateTo('/tenant/recipient-list')
    } catch (e: unknown) {
      saveError.value = fetchErrorMessage(e, 'Save failed')
    } finally {
      saving.value = false
    }
  }

  async function submitUpdate(): Promise<void> {
    const id = String(toValue(options.listId) ?? '').trim()
    if (!id) return
    saveError.value = ''
    if (!canSubmitForm.value) return
    saving.value = true
    try {
      await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        ...serverAuthHeaders(),
        body: buildSaveBody()
      })
      clearNuxtPayloadCache(TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY)
      await navigateTo(`/tenant/recipient-list/${encodeURIComponent(id)}`)
    } catch (e: unknown) {
      saveError.value = fetchErrorMessage(e, 'Save failed')
    } finally {
      saving.value = false
    }
  }

  async function hydrateFromExisting(listId: string): Promise<void> {
    loadPending.value = true
    loadError.value = ''
    try {
      const detail = await $fetch<{
        list: {
          name?: string
          associatedLoanOfficerEmail?: string
          associatedLoanOfficerName?: string
          excludedContactIds?: string[]
        }
      }>(`/api/v1/tenant/recipient-list/${encodeURIComponent(listId)}`, {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { page: 1, limit: 1 }
      })
      form.name = detail.list?.name ?? ''
      form.associatedLoanOfficerEmail =
        typeof detail.list?.associatedLoanOfficerEmail === 'string'
          ? detail.list.associatedLoanOfficerEmail.trim().toLowerCase()
          : ''
      form.associatedLoanOfficerName =
        typeof detail.list?.associatedLoanOfficerName === 'string'
          ? detail.list.associatedLoanOfficerName.trim()
          : ''
      const removedIds = new Set(
        (detail.list?.excludedContactIds ?? [])
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter(Boolean)
      )
      if (form.associatedLoanOfficerEmail) {
        await loadBorrowers({ uncheckedIds: removedIds })
      }
    } catch (e: unknown) {
      loadError.value = fetchErrorMessage(e, 'Failed to load')
    } finally {
      loadPending.value = false
    }
  }

  onMounted(async () => {
    await loadDefaultCampaignSender()
    if (options.mode === 'edit') {
      // Classic edit path when toggle OFF — skip LO hydrate.
      if (!allowTenantLoRecipientLists.value) {
        loadPending.value = false
        return
      }
      const id = String(toValue(options.listId) ?? '').trim()
      if (id) await hydrateFromExisting(id)
      else loadPending.value = false
      // LO/LOA may only manage lists for themselves.
      if (isSelfOnlyAudience.value) applySelfLoanOfficer()
    } else {
      applySelfLoanOfficer()
      loadPending.value = false
    }
  })

  return {
    allowTenantLoRecipientLists,
    isSelfOnlyAudience,
    flagLoaded,
    loadPending,
    loadError,
    saveError,
    saving,
    form,
    borrowers,
    filteredBorrowers,
    pagedBorrowers,
    borrowerSearchQ,
    borrowerPage,
    borrowerPageMeta,
    canGoBorrowerPrev,
    canGoBorrowerNext,
    goBorrowerPrev,
    goBorrowerNext,
    borrowerTotal,
    borrowersLoading,
    borrowersLoadingMore,
    borrowersLoadProgress,
    borrowersError,
    borrowerChecked,
    setBorrowerChecked,
    checkAllBorrowers,
    uncheckAllBorrowers,
    toggleAllBorrowers,
    toggleAllBorrowersLabel,
    checkedBorrowerCount,
    allBorrowersChecked,
    noBorrowersChecked,
    submitBlockReasons,
    canSubmitForm,
    onLoanOfficerSelect,
    onLoanOfficerTyped,
    loadBorrowers,
    submitCreate,
    submitUpdate
  }
}
