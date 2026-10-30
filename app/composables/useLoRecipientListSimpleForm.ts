/**
 * Simplified recipient-list create/edit when `allowTenantLoRecipientLists` is ON.
 * Classic form stays in useRecipientListForm — this path does not touch it.
 */
import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import {
  clearNuxtPayloadCache,
  TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY
} from '~/composables/useNuxtPayloadCache'

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
  const borrowersError = ref('')
  /** Contact id → included in list (default true). */
  const borrowerChecked = reactive<Record<string, boolean>>({})
  /** Exclusions outside the current preview page (edit hydrate). */
  const excludedOutsidePreview = ref<string[]>([])

  const manualEmail = ref('')
  const manualAddError = ref('')
  const manualAddPending = ref(false)
  const manualSuggestions = ref<LoBorrowerPreviewRow[]>([])
  const manualSuggestionsOpen = ref(false)
  const manualSuggestionsLoading = ref(false)
  /** `list` = borrowers checklist; `manual` = add-by-email. */
  const borrowersTab = ref<'list' | 'manual'>('list')

  let previewSeq = 0
  let manualSearchSeq = 0
  let manualSearchTimer: ReturnType<typeof setTimeout> | null = null

  const uncheckedBorrowerIds = computed(() =>
    borrowers.value.filter((b) => borrowerChecked[b.id] === false).map((b) => b.id)
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

  function clearManualAdd() {
    if (manualSearchTimer) {
      clearTimeout(manualSearchTimer)
      manualSearchTimer = null
    }
    manualEmail.value = ''
    manualAddError.value = ''
    manualAddPending.value = false
    manualSuggestions.value = []
    manualSuggestionsOpen.value = false
    manualSuggestionsLoading.value = false
  }

  function setBorrowersTab(tab: 'list' | 'manual') {
    borrowersTab.value = tab
    if (tab === 'manual') manualAddError.value = ''
    else {
      manualSuggestions.value = []
      manualSuggestionsOpen.value = false
    }
  }

  function includeBorrowerRow(row: LoBorrowerPreviewRow) {
    borrowers.value = [row, ...borrowers.value.filter((b) => b.id !== row.id)]
    borrowerChecked[row.id] = true
    excludedOutsidePreview.value = excludedOutsidePreview.value.filter((id) => id !== row.id)
    if (borrowerTotal.value < borrowers.value.length) {
      borrowerTotal.value = borrowers.value.length
    }
    clearManualAdd()
    borrowersTab.value = 'list'
  }

  async function searchManualBorrowers(raw: string) {
    const ownerEmail = form.associatedLoanOfficerEmail.trim().toLowerCase()
    const q = raw.trim()
    manualAddError.value = ''
    if (!ownerEmail || !ownerEmail.includes('@') || q.length < 2) {
      manualSuggestions.value = []
      manualSuggestionsOpen.value = false
      manualSuggestionsLoading.value = false
      return
    }
    const seq = ++manualSearchSeq
    manualSuggestionsLoading.value = true
    try {
      const res = await $fetch<{
        total: number
        borrowers: LoBorrowerPreviewRow[]
      }>('/api/v1/tenant/recipient-list/lo-borrowers', {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { ownerEmail, q, limit: 12 }
      })
      if (seq !== manualSearchSeq) return
      manualSuggestions.value = res.borrowers ?? []
      manualSuggestionsOpen.value = true
    } catch {
      if (seq !== manualSearchSeq) return
      manualSuggestions.value = []
      manualSuggestionsOpen.value = false
    } finally {
      if (seq === manualSearchSeq) manualSuggestionsLoading.value = false
    }
  }

  function onManualEmailInput() {
    manualAddError.value = ''
    if (manualSearchTimer) clearTimeout(manualSearchTimer)
    const value = manualEmail.value
    manualSearchTimer = setTimeout(() => {
      void searchManualBorrowers(value)
    }, 250)
  }

  function onManualEmailFocus() {
    if (manualEmail.value.trim().length >= 2) {
      void searchManualBorrowers(manualEmail.value)
    }
  }

  function closeManualSuggestions() {
    manualSuggestionsOpen.value = false
  }

  function selectManualSuggestion(row: LoBorrowerPreviewRow) {
    includeBorrowerRow(row)
  }

  function onLoanOfficerSelect(c: { email: string; displayName: string }) {
    if (isSelfOnlyAudience.value) return
    form.associatedLoanOfficerEmail = c.email
    form.associatedLoanOfficerName = c.displayName || c.email
    excludedOutsidePreview.value = []
    clearManualAdd()
    borrowersTab.value = 'list'
    void loadBorrowers()
  }

  function onLoanOfficerTyped() {
    if (isSelfOnlyAudience.value) return
    form.associatedLoanOfficerName = ''
    borrowers.value = []
    borrowerTotal.value = 0
    excludedOutsidePreview.value = []
    clearManualAdd()
    borrowersTab.value = 'list'
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

  async function addBorrowerByEmail(): Promise<void> {
    manualAddError.value = ''
    const ownerEmail = form.associatedLoanOfficerEmail.trim().toLowerCase()
    const email = manualEmail.value.trim().toLowerCase()
    if (!ownerEmail || !ownerEmail.includes('@')) {
      manualAddError.value = 'Select a loan officer first.'
      return
    }
    if (!email || !email.includes('@')) {
      manualAddError.value = 'Enter a valid borrower email for this loan officer.'
      return
    }

    const existing = borrowers.value.find((b) => b.email.trim().toLowerCase() === email)
    if (existing) {
      includeBorrowerRow(existing)
      return
    }

    // Prefer an open suggestion with exact email match (same LO search results).
    const fromSuggestions = manualSuggestions.value.find(
      (b) => b.email.trim().toLowerCase() === email
    )
    if (fromSuggestions) {
      includeBorrowerRow(fromSuggestions)
      return
    }

    manualAddPending.value = true
    try {
      const res = await $fetch<{
        total: number
        borrowers: LoBorrowerPreviewRow[]
      }>('/api/v1/tenant/recipient-list/lo-borrowers', {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { ownerEmail, email, limit: 1 }
      })
      const row = res.borrowers?.[0]
      if (!row?.id) {
        manualAddError.value =
          'No borrower with that email for this loan officer. Only borrowers owned by the selected LO can be added.'
        return
      }
      includeBorrowerRow(row)
    } catch (e: unknown) {
      manualAddError.value = fetchErrorMessage(e, 'Failed to look up email')
    } finally {
      manualAddPending.value = false
    }
  }

  async function loadBorrowers(opts?: { uncheckedIds?: Set<string> }) {
    const email = form.associatedLoanOfficerEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      borrowers.value = []
      borrowerTotal.value = 0
      resetBorrowerChecks([])
      return
    }
    const seq = ++previewSeq
    borrowersLoading.value = true
    borrowersError.value = ''
    try {
      const res = await $fetch<{
        total: number
        borrowers: LoBorrowerPreviewRow[]
      }>('/api/v1/tenant/recipient-list/lo-borrowers', {
        credentials: 'include',
        ...serverAuthHeaders(),
        query: { ownerEmail: email, limit: 50 }
      })
      if (seq !== previewSeq) return
      const rows = res.borrowers ?? []
      borrowers.value = rows
      borrowerTotal.value = res.total ?? 0
      resetBorrowerChecks(rows, opts?.uncheckedIds)
      if (opts?.uncheckedIds) {
        const previewIds = new Set(rows.map((r) => r.id))
        excludedOutsidePreview.value = [...opts.uncheckedIds].filter((id) => !previewIds.has(id))
      }
    } catch (e: unknown) {
      if (seq !== previewSeq) return
      borrowers.value = []
      borrowerTotal.value = 0
      resetBorrowerChecks([])
      borrowersError.value =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Failed to load borrowers')
          : 'Failed to load borrowers'
    } finally {
      if (seq === previewSeq) borrowersLoading.value = false
    }
  }

  function buildSaveBody(): Record<string, unknown> {
    const excludedContactIds = [
      ...excludedOutsidePreview.value,
      ...uncheckedBorrowerIds.value
    ]
    return {
      name: form.name.trim(),
      audience: 'borrower',
      filterMode: 'and',
      filterRows: [],
      associatedLoanOfficerEmail: form.associatedLoanOfficerEmail.trim().toLowerCase(),
      associatedLoanOfficerName: form.associatedLoanOfficerName.trim(),
      excludedContactIds
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
    borrowerTotal,
    borrowersLoading,
    borrowersError,
    borrowerChecked,
    setBorrowerChecked,
    checkAllBorrowers,
    uncheckAllBorrowers,
    toggleAllBorrowers,
    toggleAllBorrowersLabel,
    allBorrowersChecked,
    noBorrowersChecked,
    manualEmail,
    manualAddError,
    manualAddPending,
    manualSuggestions,
    manualSuggestionsOpen,
    manualSuggestionsLoading,
    onManualEmailInput,
    onManualEmailFocus,
    closeManualSuggestions,
    selectManualSuggestion,
    borrowersTab,
    setBorrowersTab,
    addBorrowerByEmail,
    submitBlockReasons,
    canSubmitForm,
    onLoanOfficerSelect,
    onLoanOfficerTyped,
    loadBorrowers,
    submitCreate,
    submitUpdate
  }
}
