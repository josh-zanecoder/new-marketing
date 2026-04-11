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

export interface RecipientListContactTypeOption {
  key: string
  label: string
  sortOrder: number
  /** When false, exclude from audience picker. */
  enabled?: boolean
}

export interface RecipientListFormPayload {
  tenantIdConfigured: boolean
  contactCounts: Record<string, number>
  /** Enabled rows from tenant `contact_types` (labels for audience picker). */
  contactTypes?: RecipientListContactTypeOption[]
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
    criterionJoins?: ('and' | 'or')[]
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
    criterionJoins: ('and' | 'or')[]
  }
  audienceOptions: ComputedRef<{ value: string; label: string }[]>
  filtersForAudience: ComputedRef<RegistryFilterRow[]>
  selectableFiltersForRow: (_rowIdx: number) => RegistryFilterRow[]
  canAddFilter: ComputedRef<boolean>
  showPropertyRowFor: (row: RecipientListFilterRow) => boolean
  rowRegistryTokens: (row: RecipientListFilterRow) => string[]
  propertyValuePlaceholderFor: (row: RecipientListFilterRow) => string
  showCombineBeforeFormRow: (formIdx: number) => boolean
  joinSlotBeforeFormRow: (formIdx: number) => number
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
    filterMode: 'and' as 'and' | 'or',
    criterionJoins: [] as ('and' | 'or')[]
  })

  const audienceOptions = computed((): { value: string; label: string }[] => {
    const d = data.value
    if (!d) return []
    const seen = new Set<string>()
    for (const f of d.recipientFilters ?? []) {
      if (f.enabled && typeof f.contactType === 'string' && f.contactType.trim()) {
        seen.add(f.contactType.trim().toLowerCase())
      }
    }
    for (const t of d.contactTypes ?? []) {
      if (t.enabled === false) continue
      const k = t.key.trim().toLowerCase()
      if (k) seen.add(k)
    }
    const labelByKey = new Map<string, string>()
    const orderByKey = new Map<string, number>()
    for (const t of d.contactTypes ?? []) {
      const k = t.key.trim().toLowerCase()
      if (!k) continue
      labelByKey.set(k, t.label.trim() || k)
      orderByKey.set(k, t.sortOrder ?? 0)
    }
    const keys = [...seen]
    keys.sort((a, b) => {
      const oa = orderByKey.has(a) ? orderByKey.get(a)! : 9999
      const ob = orderByKey.has(b) ? orderByKey.get(b)! : 9999
      if (oa !== ob) return oa - ob
      return a.localeCompare(b)
    })
    const counts = d.contactCounts
    return keys.map((value) => {
      const baseLabel =
        labelByKey.get(value) ??
        value.charAt(0).toUpperCase() + value.slice(1)
      const n = counts[value as keyof typeof counts]
      const label =
        typeof n === 'number' && Number.isFinite(n)
          ? `${baseLabel} (${n.toLocaleString()})`
          : baseLabel
      return { value, label }
    })
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
    const aud = form.audience.trim().toLowerCase()
    return d.recipientFilters.filter((f) => {
      if (!f.enabled) return false
      return (f.contactType ?? '').trim().toLowerCase() === aud
    })
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

  function rowHasFilterId(row: RecipientListFilterRow): boolean {
    return Boolean(String(row.recipientFilterId ?? '').trim())
  }

  /** AND/OR before this row (row index ≥ 1), once the previous row has a filter — including a newly added empty row. */
  function showCombineBeforeFormRow(formIdx: number): boolean {
    if (formIdx <= 0) return false
    const prev = form.filterRows[formIdx - 1]
    return prev != null && rowHasFilterId(prev)
  }

  /** Same slot as join between row formIdx−1 and formIdx (left-associative chain). */
  function joinSlotBeforeFormRow(formIdx: number): number {
    return (
      form.filterRows
        .slice(0, formIdx)
        .filter((r) => rowHasFilterId(r)).length - 1
    )
  }

  watch(
    () => form.filterRows.map((r) => String(r.recipientFilterId ?? '').trim()),
    () => {
      const n = Math.max(
        0,
        form.filterRows.filter((r) => rowHasFilterId(r)).length - 1
      )
      while (form.criterionJoins.length < n) form.criterionJoins.push('and')
      if (form.criterionJoins.length > n) form.criterionJoins.splice(n)
    },
    { deep: true, immediate: true }
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
      contactCounts: res.contactCounts ?? {},
      contactTypes: res.contactTypes ?? [],
      recipientFilters: res.recipientFilters ?? []
    }
  }

  function buildSaveBody(): Record<string, unknown> {
    const persistedRows = form.filterRows
      .filter((r) => r.recipientFilterId.trim())
      .map((r) => ({
        recipientFilterId: r.recipientFilterId.trim(),
        listPropertyValue: r.listPropertyValue.trim()
      }))
    const need = Math.max(0, persistedRows.length - 1)
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      audience: form.audience,
      filterRows: persistedRows,
      filterMode: form.filterMode
    }
    if (need > 0) {
      body.criterionJoins = form.criterionJoins.slice(0, need)
    }
    return body
  }

  function fetchErrorMessage(e: unknown, fallback: string): string {
    return e && typeof e === 'object' && 'data' in e
      ? String((e as { data?: { message?: string } }).data?.message ?? fallback)
      : fallback
  }

  function hydrateFromList(list: ListDetailForEdit['list']) {
    form.name = list.name ?? ''
    form.audience = (list.audience ?? '').trim().toLowerCase()
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

    const savedCount = form.filterRows.filter((r) => rowHasFilterId(r)).length
    const need = Math.max(0, savedCount - 1)
    form.criterionJoins.splice(0, form.criterionJoins.length)
    const api = list.criterionJoins
    for (let i = 0; i < need; i++) {
      if (Array.isArray(api) && api.length === need && (api[i] === 'or' || api[i] === 'and')) {
        form.criterionJoins.push(api[i] === 'or' ? 'or' : 'and')
      } else if (need === 1 && list.filterMode === 'or') {
        form.criterionJoins.push('or')
      } else {
        form.criterionJoins.push('and')
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
    showCombineBeforeFormRow,
    joinSlotBeforeFormRow,
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
