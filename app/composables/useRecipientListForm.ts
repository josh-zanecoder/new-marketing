import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, isRef, toValue } from 'vue'

export interface RegistryFilterRow {
  id: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  enabled: boolean
}

export interface RecipientListFormPayload {
  tenantIdConfigured: boolean
  contactCounts: Record<string, number>
  recipientFilters: RegistryFilterRow[]
}

export interface RecipientListFilterRow {
  recipientFilterId: string
  listPropertyValue: string
}

interface ListDetailForEdit {
  list: {
    name: string
    audience: string
    filterMode?: 'and' | 'or'
    filterRows?: { recipientFilterId: string; listPropertyValue: string }[]
  }
}

export type UseRecipientListFormOptions =
  | { mode: 'create' }
  | { mode: 'edit'; listId: MaybeRefOrGetter<string> }

export type RecipientListFormSharedReturn = {
  loadPending: Ref<boolean>
  loadError: Ref<string>
  saveError: Ref<string>
  saving: Ref<boolean>
  data: Ref<RecipientListFormPayload | null>
  form: {
    name: string
    audience: string
    filterRows: RecipientListFilterRow[]
    filterMode: 'and' | 'or'
  }
  audienceOptions: ComputedRef<{ value: string; label: string }[]>
  filtersForAudience: ComputedRef<RegistryFilterRow[]>
  selectableFiltersForRow: (_rowIdx: number) => RegistryFilterRow[]
  canAddFilter: ComputedRef<boolean>
  showPropertyRowFor: (row: RecipientListFilterRow) => boolean
  rowRegistryTokens: (row: RecipientListFilterRow) => string[]
  propertyValuePlaceholderFor: (row: RecipientListFilterRow) => string
  showCombineCriteria: ComputedRef<boolean>
  canSubmitPropertyValue: ComputedRef<boolean>
  onRowFilterChange: (row: RecipientListFilterRow) => void
  addFilterRow: () => void
  removeFilterRow: (idx: number) => void
  filterOptionLabel: (f: RegistryFilterRow) => string
}

export type RecipientListFormCreateReturn = RecipientListFormSharedReturn & {
  load: () => Promise<void>
  submitCreate: () => Promise<void>
}

export type RecipientListFormEditReturn = RecipientListFormSharedReturn & {
  listId: Ref<string>
  loadAll: (listId: string) => Promise<void>
  submitUpdate: () => Promise<void>
}

const AUDIENCE_ORDER = ['prospect', 'client', 'contact'] as const

const PROPERTY_FIELD_LABELS: Record<string, string> = {
  none: 'None',
  address: 'Address',
  channel: 'Channel',
  company: 'Company',
  source: 'Source',
  email: 'Email'
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  none: '',
  state: 'State',
  city: 'City',
  county: 'County',
  street: 'Street'
}

export function useRecipientListForm(options: { mode: 'create' }): RecipientListFormCreateReturn
export function useRecipientListForm(options: {
  mode: 'edit'
  listId: MaybeRefOrGetter<string>
}): RecipientListFormEditReturn
export function useRecipientListForm(options: UseRecipientListFormOptions): RecipientListFormCreateReturn | RecipientListFormEditReturn {
  const { serverAuthHeaders } = useTenantMarketingApi()

  const loadPending = ref(true)
  const loadError = ref('')
  const saveError = ref('')
  const saving = ref(false)
  const data = ref<RecipientListFormPayload | null>(null)

  const skipAudienceClear =
    options.mode === 'edit' ? ref(true) : null

  const form = reactive({
    name: '',
    audience: '',
    filterRows: [] as RecipientListFilterRow[],
    filterMode: 'and' as 'and' | 'or'
  })

  const audienceOptions = computed((): { value: string; label: string }[] => {
    const d = data.value
    if (!d?.recipientFilters?.length) return []
    const seen = new Set<string>()
    for (const f of d.recipientFilters) {
      if (f.enabled && typeof f.contactType === 'string' && f.contactType.trim()) {
        seen.add(f.contactType.trim())
      }
    }
    const ordered = AUDIENCE_ORDER.filter((k) => seen.has(k))
    const extra = [...seen].filter(
      (k) => !AUDIENCE_ORDER.includes(k as (typeof AUDIENCE_ORDER)[number])
    )
    extra.sort()
    return [...ordered, ...extra].map((value) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1)
    }))
  })

  watch(
    audienceOptions,
    (opts) => {
      if (!opts.length) {
        form.audience = ''
        return
      }
      if (!opts.some((o) => o.value === form.audience)) {
        form.audience = opts[0]?.value ?? ''
      }
    },
    { immediate: true }
  )

  const filtersForAudience = computed(() => {
    const d = data.value
    if (!d) return []
    return d.recipientFilters.filter(
      (f) => f.contactType === form.audience && f.enabled
    )
  })

  function selectableFiltersForRow(_rowIdx: number): RegistryFilterRow[] {
    return filtersForAudience.value
  }

  const canAddFilter = computed(() => filtersForAudience.value.length > 0)

  function rowFilter(row: RecipientListFilterRow): RegistryFilterRow | null {
    const id = row.recipientFilterId
    if (!id) return null
    return filtersForAudience.value.find((f) => f.id === id) ?? null
  }

  function showPropertyRowFor(row: RecipientListFilterRow): boolean {
    const f = rowFilter(row)
    return f != null && f.property !== 'none'
  }

  function tokenizePropertyValue(raw: string): string[] {
    return raw
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function rowRegistryTokens(row: RecipientListFilterRow): string[] {
    const f = rowFilter(row)
    if (!f || f.property === 'none') return []
    return tokenizePropertyValue(f.propertyValue ?? '')
  }

  function propertyValuePlaceholderFor(row: RecipientListFilterRow): string {
    const f = rowFilter(row)
    if (!f) return 'Value'
    if (f.property === 'source') return 'e.g. webinar, import'
    if (f.property === 'address' && f.propertyType === 'county') {
      return 'e.g. Suffolk'
    }
    if (f.property === 'address' && f.propertyType === 'state') {
      return 'e.g. TX'
    }
    return 'Enter value to match'
  }

  const showCombineCriteria = computed(
    () =>
      form.filterRows.filter((r) => String(r.recipientFilterId ?? '').trim()).length >= 2
  )

  const canSubmitPropertyValue = computed(() => {
    for (const row of form.filterRows) {
      if (!row.recipientFilterId.trim()) return false
      const f = rowFilter(row)
      if (!f || f.property === 'none') continue
      const tokens = rowRegistryTokens(row)
      if (tokens.length > 1) {
        if (!row.listPropertyValue.trim()) return false
      } else if (tokens.length === 1) {
        /* preset single value ok */
      } else {
        if (!row.listPropertyValue.trim()) return false
      }
    }
    return true
  })

  watch(
    () => form.audience,
    () => {
      if (skipAudienceClear?.value) return
      form.filterRows = []
    }
  )

  function onRowFilterChange(row: RecipientListFilterRow) {
    row.listPropertyValue = ''
    const f = rowFilter(row)
    if (!f || f.property === 'none') return
    const tokens = tokenizePropertyValue(f.propertyValue ?? '')
    if (tokens.length === 1) {
      row.listPropertyValue = tokens[0] ?? ''
    }
    if (tokens.length > 1) {
      const first = tokens[0] ?? ''
      row.listPropertyValue = first
    }
  }

  function addFilterRow() {
    form.filterRows.push({ recipientFilterId: '', listPropertyValue: '' })
  }

  function removeFilterRow(idx: number) {
    form.filterRows.splice(idx, 1)
  }

  function propertyFieldLabel(property: string): string {
    return PROPERTY_FIELD_LABELS[property] ?? property
  }

  function propertyTypeLabel(propertyType: string): string {
    return PROPERTY_TYPE_LABELS[propertyType] ?? propertyType
  }

  function filterOptionLabel(f: RegistryFilterRow): string {
    if (f.property === 'none') return 'None'
    const prop = propertyFieldLabel(f.property)
    const typeOk = Boolean(f.propertyType && f.propertyType !== 'none')
    if (typeOk) {
      return `${prop} · ${propertyTypeLabel(f.propertyType)}`
    }
    return prop
  }

  function normalizePayload(res: RecipientListFormPayload): RecipientListFormPayload {
    return {
      tenantIdConfigured: res.tenantIdConfigured,
      contactCounts: res.contactCounts ?? {
        prospect: 0,
        client: 0,
        contact: 0
      },
      recipientFilters: res.recipientFilters ?? []
    }
  }

  function buildSaveBody(): Record<string, unknown> {
    return {
      name: form.name.trim(),
      audience: form.audience,
      filterRows: form.filterRows
        .filter((r) => r.recipientFilterId.trim())
        .map((r) => ({
          recipientFilterId: r.recipientFilterId.trim(),
          listPropertyValue: r.listPropertyValue.trim()
        })),
      filterMode: showCombineCriteria.value ? form.filterMode : 'and'
    }
  }

  function fetchErrorMessage(e: unknown, fallback: string): string {
    return e && typeof e === 'object' && 'data' in e
      ? String((e as { data?: { message?: string } }).data?.message ?? fallback)
      : fallback
  }

  function hydrateFromList(list: ListDetailForEdit['list']) {
    form.name = list.name ?? ''
    form.audience = list.audience ?? ''
    form.filterMode = list.filterMode === 'or' ? 'or' : 'and'
    const rows = list.filterRows?.length
      ? list.filterRows.map((r) => ({
          recipientFilterId: String(r.recipientFilterId ?? '').trim(),
          listPropertyValue: String(r.listPropertyValue ?? '').trim()
        }))
      : []
    form.filterRows = rows
    for (const row of form.filterRows) {
      const f = rowFilter(row)
      if (!f || f.property === 'none') continue
      const tokens = tokenizePropertyValue(f.propertyValue ?? '')
      if (!row.listPropertyValue.trim() && tokens.length === 1) {
        row.listPropertyValue = tokens[0] ?? ''
      }
    }
  }

  async function loadFormPayload(): Promise<void> {
    const res = await $fetch<RecipientListFormPayload>('/api/v1/tenant/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders()
    })
    data.value = normalizePayload(res)
  }

  async function load(): Promise<void> {
    loadPending.value = true
    loadError.value = ''
    try {
      await loadFormPayload()
    } catch (e: unknown) {
      loadError.value = fetchErrorMessage(e, 'Failed to load')
      data.value = null
    } finally {
      loadPending.value = false
    }
  }

  async function submitCreate(): Promise<void> {
    saveError.value = ''
    saving.value = true
    try {
      await $fetch('/api/v1/tenant/recipient-list', {
        method: 'POST',
        credentials: 'include',
        ...serverAuthHeaders(),
        body: buildSaveBody()
      })
      await navigateTo('/tenant/recipient-list')
    } catch (e: unknown) {
      saveError.value = fetchErrorMessage(e, 'Save failed')
    } finally {
      saving.value = false
    }
  }

  async function loadAll(listId: string): Promise<void> {
    loadPending.value = true
    loadError.value = ''
    if (skipAudienceClear) skipAudienceClear.value = true
    try {
      if (!listId) {
        loadError.value = 'Missing list id'
        data.value = null
        return
      }
      const [res, detail] = await Promise.all([
        $fetch<RecipientListFormPayload>('/api/v1/tenant/recipient-list', {
          credentials: 'include',
          ...serverAuthHeaders()
        }),
        $fetch<ListDetailForEdit>(`/api/v1/tenant/recipient-list/${encodeURIComponent(listId)}`, {
          credentials: 'include',
          ...serverAuthHeaders(),
          query: { page: 1, limit: 1 }
        })
      ])
      data.value = normalizePayload(res)
      hydrateFromList(detail.list)
      await nextTick()
      if (skipAudienceClear) skipAudienceClear.value = false
    } catch (e: unknown) {
      loadError.value = fetchErrorMessage(e, 'Failed to load')
      data.value = null
    } finally {
      loadPending.value = false
    }
  }

  async function submitUpdate(listId: string): Promise<void> {
    if (!listId) return
    saveError.value = ''
    saving.value = true
    try {
      await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(listId)}`, {
        method: 'PATCH',
        credentials: 'include',
        ...serverAuthHeaders(),
        body: buildSaveBody()
      })
      await navigateTo(`/tenant/recipient-list/${encodeURIComponent(listId)}`)
    } catch (e: unknown) {
      saveError.value = fetchErrorMessage(e, 'Save failed')
    } finally {
      saving.value = false
    }
  }

  const shared = {
    loadPending,
    loadError,
    saveError,
    saving,
    data,
    form,
    audienceOptions,
    filtersForAudience,
    selectableFiltersForRow,
    canAddFilter,
    showPropertyRowFor,
    rowRegistryTokens,
    propertyValuePlaceholderFor,
    showCombineCriteria,
    canSubmitPropertyValue,
    onRowFilterChange,
    addFilterRow,
    removeFilterRow,
    filterOptionLabel
  }

  if (options.mode === 'create') {
    onMounted(() => {
      void load()
    })
    return {
      ...shared,
      load,
      submitCreate
    }
  }

  const listIdRef = isRef(options.listId)
    ? options.listId
    : computed(() => String(toValue(options.listId) ?? ''))

  watch(
    listIdRef,
    (id) => {
      void loadAll(id)
    },
    { immediate: true }
  )

  async function submitUpdateBound(): Promise<void> {
    await submitUpdate(listIdRef.value)
  }

  return {
    ...shared,
    listId: listIdRef,
    loadAll,
    submitUpdate: submitUpdateBound
  }
}
