import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import { computed, isRef, toValue } from 'vue'
import type { FilterSelectOption } from '~/components/tenant/FilterSelect.vue'
import {
  recipientFilterPropertyLabel,
  recipientFilterPropertyTypeLabel,
  recipientFilterValueDisplay
} from '~/utils/recipientFilterDisplay'
import { recipientFilterPropertyValueTokens } from '~~/shared/utils/recipientFilterPropertyValue'

export interface RegistryFilterRow {
  id: string
  name: string
  contactType: string
  property: string
  propertyType: string
  propertyValue: string
  /** Admin sourced this filter's values from the contacts instead of typing one. */
  valuesFromContacts?: boolean
  /** Distinct contact values to choose from when `valuesFromContacts` is set. */
  valueOptions?: string[]
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

export type RecipientListJoin = 'and' | 'or'
/** Empty until the person picks And or Or. */
export type RecipientListJoinChoice = '' | RecipientListJoin

export type RecipientListPreviewPart =
  | { kind: 'paren'; side: '(' | ')' }
  | { kind: 'join'; join: RecipientListJoinChoice; level: 'group' | 'condition' }
  | { kind: 'clause'; field: string; value: string; incomplete: boolean }
  | { kind: 'placeholder'; text: string }

export interface RecipientListFilterGroup {
  rows: RecipientListFilterRow[]
  /** How conditions inside this group combine. Length = filled rows − 1. Empty until chosen. */
  joins: RecipientListJoinChoice[]
}

interface ListDetailForEdit {
  list: {
    name: string
    audience: string
    filterMode?: 'and' | 'or'
    criterionJoins?: ('and' | 'or')[]
    filterRows?: { recipientFilterId: string; listPropertyValue: string }[]
    filterGroups?: {
      rows: { recipientFilterId: string; listPropertyValue: string }[]
      joins: ('and' | 'or')[]
    }[]
    groupJoins?: ('and' | 'or')[]
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
    filterGroups: RecipientListFilterGroup[]
    groupJoins: RecipientListJoinChoice[]
    filterMode: 'and' | 'or'
    criterionJoins: ('and' | 'or')[]
  }
  audienceOptions: ComputedRef<{ value: string; label: string }[]>
  audienceFieldSelectOptions: ComputedRef<FilterSelectOption[]>
  filtersForAudience: ComputedRef<RegistryFilterRow[]>
  canAddFilter: ComputedRef<boolean>
  showPropertyRowFor: (row: RecipientListFilterRow) => boolean
  rowRegistryTokens: (row: RecipientListFilterRow) => string[]
  propertyValuePlaceholderFor: (row: RecipientListFilterRow) => string
  showCombineBeforeFormRow: (group: RecipientListFilterGroup, formIdx: number) => boolean
  joinSlotBeforeFormRow: (group: RecipientListFilterGroup, formIdx: number) => number
  conditionNumber: (groupIndex: number, rowIndex: number) => number
  conditionCount: ComputedRef<number>
  conditionSummary: (row: RecipientListFilterRow) => string
  filterPreview: ComputedRef<{
    audienceLabel: string
    empty: boolean
    parts: RecipientListPreviewPart[]
  }>
  addFilterGroup: () => void
  removeFilterGroup: (groupIndex: number) => void
  canSubmitForm: ComputedRef<boolean>
  submitBlockReasons: ComputedRef<string[]>
  recipientFilterSelectOptions: (rowIdx: number) => FilterSelectOption[]
  registryValueSelectOptions: (row: RecipientListFilterRow) => FilterSelectOption[]
  onRowFilterChange: (row: RecipientListFilterRow) => void
  addFilterRow: (groupIndex?: number) => void
  removeFilterRow: (groupIndex: number, rowIndex: number) => void
  filterOptionLabel: (f: RegistryFilterRow) => string
  matchRuleFieldLabel: (row: RecipientListFilterRow) => string
  /** Display-only: the single saved value of this row's filter, prettified when it is a registry key. */
  rowRegistryValueDisplay: (row: RecipientListFilterRow) => string
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
  status: 'Status',
  stage: 'Stage',
  source: 'Source',
  email: 'Email',
  priority: 'Priority',
  broker_role: 'Broker role',
  account_owner: 'Account owner',
  contact_profile: 'Contact profile',
  search: 'Search'
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  none: '',
  state: 'State',
  city: 'City',
  county: 'County',
  street: 'Street',
  profile_type: 'Type',
  profile_subtype: 'Sub Type'
}

const CHOOSE_FIELD_LABEL = 'Choose a field…'
const CHOOSE_VALUE_LABEL = 'Choose a value…'

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
    filterGroups: [] as RecipientListFilterGroup[],
    groupJoins: [] as RecipientListJoinChoice[],
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

  const audienceFieldSelectOptions = computed((): FilterSelectOption[] => {
    if (!audienceOptions.value.length) {
      return [{ value: '', label: 'No audience types available' }]
    }
    return audienceOptions.value
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

  const canAddFilter = computed(() => filtersForAudience.value.length > 0)

  function rowFilter(row: RecipientListFilterRow): RegistryFilterRow | null {
    const id = row.recipientFilterId
    if (!id) return null
    return filtersForAudience.value.find((f) => f.id === id) ?? null
  }

  function rowMissingPropertyValue(row: RecipientListFilterRow): 'choose' | 'enter' | null {
    const f = rowFilter(row)
    if (!f || f.property === 'none') return null
    const tokens = rowRegistryTokens(row)
    if (tokens.length === 1 || row.listPropertyValue.trim()) return null
    return tokens.length > 1 ? 'choose' : 'enter'
  }

  const submitBlockReasons = computed((): string[] => {
    const reasons: string[] = []
    if (!form.name.trim()) {
      reasons.push('Enter a list name.')
    }
    if (!audienceOptions.value.length) {
      reasons.push('Add at least one enabled contact type before saving.')
    }
    form.filterGroups.forEach((group, gIdx) => {
      group.rows.forEach((row, idx) => {
        const condition = conditionNumber(gIdx, idx)
        if (!row.recipientFilterId.trim()) {
          reasons.push(`Choose a field for condition ${condition}.`)
          return
        }
        const missing = rowMissingPropertyValue(row)
        if (missing === 'choose') {
          reasons.push(`Choose a value for condition ${condition}.`)
        } else if (missing === 'enter') {
          reasons.push(`Enter a value for condition ${condition}.`)
        }
        if (idx > 0 && rowHasFilterId(group.rows[idx - 1]!)) {
          const slot = joinSlotBeforeFormRow(group, idx)
          if (group.joins[slot] !== 'and' && group.joins[slot] !== 'or') {
            reasons.push(`Choose And or Or between condition ${conditionNumber(gIdx, idx - 1)} and condition ${condition}.`)
          }
        }
      })
    })
    for (let i = 0; i < form.filterGroups.length - 1; i++) {
      if (form.groupJoins[i] !== 'and' && form.groupJoins[i] !== 'or') {
        reasons.push(`Choose And or Or between group ${i + 1} and group ${i + 2}.`)
      }
    }
    return reasons
  })

  const canSubmitForm = computed(() => submitBlockReasons.value.length === 0)

  function showPropertyRowFor(row: RecipientListFilterRow): boolean {
    const f = rowFilter(row)
    return f != null && f.property !== 'none'
  }

  /** Contact-sourced options stand in for the admin-typed value, so the row behaves the same way. */
  function filterTokens(f: RegistryFilterRow): string[] {
    if (f.valuesFromContacts) {
      return (f.valueOptions ?? []).map((v) => String(v ?? '').trim()).filter(Boolean)
    }
    return recipientFilterPropertyValueTokens(f.propertyValue ?? '', f.property, f.propertyType)
  }

  function rowRegistryTokens(row: RecipientListFilterRow): string[] {
    const f = rowFilter(row)
    if (!f || f.property === 'none') return []
    return filterTokens(f)
  }

  function rowRegistryValueDisplay(row: RecipientListFilterRow): string {
    const f = rowFilter(row)
    if (!f) return ''
    const token = rowRegistryTokens(row)[0] ?? ''
    return recipientFilterValueDisplay(token, f.property, f.propertyType)
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

  /** AND/OR before this row, once the previous row in the same group has a filter. */
  function showCombineBeforeFormRow(group: RecipientListFilterGroup, formIdx: number): boolean {
    if (formIdx <= 0) return false
    const prev = group.rows[formIdx - 1]
    return prev != null && rowHasFilterId(prev)
  }

  function joinSlotBeforeFormRow(group: RecipientListFilterGroup, formIdx: number): number {
    return group.rows.slice(0, formIdx).filter((r) => rowHasFilterId(r)).length - 1
  }

  function conditionNumber(groupIndex: number, rowIndex: number): number {
    let n = rowIndex + 1
    for (let i = 0; i < groupIndex; i++) n += form.filterGroups[i]?.rows.length ?? 0
    return n
  }

  const conditionCount = computed(() =>
    form.filterGroups.reduce((n, group) => n + group.rows.length, 0)
  )

  function previewClause(row: RecipientListFilterRow): RecipientListPreviewPart {
    const f = rowFilter(row)
    if (!f) return { kind: 'placeholder', text: 'choose a field' }
    if (f.property === 'none') return { kind: 'clause', field: 'No extra filter', value: '', incomplete: false }
    const missing = rowMissingPropertyValue(row)
    const raw = row.listPropertyValue.trim()
    const value = missing
      ? ''
      : rowRegistryTokens(row).length === 1
        ? rowRegistryValueDisplay(row)
        : recipientFilterValueDisplay(raw, f.property, f.propertyType) || raw
    return { kind: 'clause', field: filterOptionLabel(f), value, incomplete: Boolean(missing) }
  }

  function conditionSummary(row: RecipientListFilterRow): string {
    const part = previewClause(row)
    if (part.kind === 'placeholder') return 'Choose which field to filter on'
    if (part.kind !== 'clause') return ''
    if (!part.value && part.incomplete) return 'Pick a value to finish this rule'
    if (!part.value) return part.field
    return `${part.field} equals ${part.value}`
  }

  const filterPreview = computed(() => {
    const key = form.audience.trim().toLowerCase()
    const named = (data.value?.contactTypes ?? []).find((t) => t.key.trim().toLowerCase() === key)
    const audienceLabel = named?.label.trim() || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'contacts')
    const groups = form.filterGroups
    if (!groups.length) return { audienceLabel, empty: true, parts: [] as RecipientListPreviewPart[] }
    const parts: RecipientListPreviewPart[] = []
    const wrapGroups = groups.length > 1
    groups.forEach((group, gIdx) => {
      const wrap = wrapGroups || group.rows.length > 1
      if (wrap) parts.push({ kind: 'paren', side: '(' })
      group.rows.forEach((row, idx) => {
        if (idx > 0 && rowHasFilterId(group.rows[idx - 1]!)) {
          const slot = joinSlotBeforeFormRow(group, idx)
          parts.push({
            kind: 'join',
            join: group.joins[slot] === 'or' ? 'or' : group.joins[slot] === 'and' ? 'and' : '',
            level: 'condition'
          })
        }
        parts.push(previewClause(row))
      })
      if (wrap) parts.push({ kind: 'paren', side: ')' })
      if (gIdx < groups.length - 1) {
        parts.push({
          kind: 'join',
          join: form.groupJoins[gIdx] === 'or' ? 'or' : form.groupJoins[gIdx] === 'and' ? 'and' : '',
          level: 'group'
        })
      }
    })
    return { audienceLabel, empty: false, parts }
  })

  watch(
    () =>
      form.filterGroups.map((group) =>
        group.rows.map((r) => String(r.recipientFilterId ?? '').trim())
      ),
    () => {
      for (const group of form.filterGroups) {
        const n = Math.max(0, group.rows.filter((r) => rowHasFilterId(r)).length - 1)
        while (group.joins.length < n) group.joins.push('')
        if (group.joins.length > n) group.joins.splice(n)
      }
      const groupNeed = Math.max(0, form.filterGroups.length - 1)
      while (form.groupJoins.length < groupNeed) form.groupJoins.push('')
      if (form.groupJoins.length > groupNeed) form.groupJoins.splice(groupNeed)
      form.filterRows = form.filterGroups.flatMap((group) => group.rows)
    },
    { deep: true, immediate: true }
  )

  function recipientFilterSelectOptions(_rowIdx: number): FilterSelectOption[] {
    const items = filtersForAudience.value.map((f) => ({
      value: f.id,
      label: filterOptionLabel(f)
    }))
    if (items.length > 1) {
      return [{ value: '', label: CHOOSE_FIELD_LABEL }, ...items]
    }
    return items
  }

  function registryValueSelectOptions(row: RecipientListFilterRow): FilterSelectOption[] {
    const f = rowFilter(row)
    if (!f) return [{ value: '', label: CHOOSE_VALUE_LABEL }]
    const tokens = rowRegistryTokens(row)
    /** A saved value no longer offered (e.g. that company left the contacts) must not vanish. */
    const saved = row.listPropertyValue.trim()
    if (saved && !tokens.includes(saved)) tokens.push(saved)
    return [
      { value: '', label: CHOOSE_VALUE_LABEL },
      ...tokens.map((opt) => ({
        value: opt,
        label: recipientFilterValueDisplay(opt, f.property, f.propertyType)
      }))
    ]
  }

  watch(
    () => form.audience,
    () => {
      if (skipAudienceClear?.value) return
      form.filterGroups.splice(0, form.filterGroups.length)
      form.groupJoins.splice(0, form.groupJoins.length)
    }
  )

  function onRowFilterChange(row: RecipientListFilterRow) {
    row.listPropertyValue = ''
    const f = rowFilter(row)
    if (!f || f.property === 'none') return
    const tokens = filterTokens(f)
    if (tokens.length === 1) {
      row.listPropertyValue = tokens[0] ?? ''
    }
  }

  function addFilterGroup() {
    form.filterGroups.push({
      rows: [{ recipientFilterId: '', listPropertyValue: '' }],
      joins: []
    })
  }

  function removeFilterGroup(groupIndex: number) {
    form.filterGroups.splice(groupIndex, 1)
    if (groupIndex === 0) form.groupJoins.splice(0, 1)
    else form.groupJoins.splice(groupIndex - 1, 1)
  }

  function addFilterRow(groupIndex?: number) {
    if (!form.filterGroups.length) {
      addFilterGroup()
      return
    }
    const idx = groupIndex == null ? form.filterGroups.length - 1 : groupIndex
    const group = form.filterGroups[idx]
    if (!group) return
    group.rows.push({ recipientFilterId: '', listPropertyValue: '' })
  }

  function removeFilterRow(groupIndex: number, rowIndex: number) {
    const group = form.filterGroups[groupIndex]
    if (!group) return
    group.rows.splice(rowIndex, 1)
    if (!group.rows.length) removeFilterGroup(groupIndex)
  }

  function propertyFieldLabel(property: string): string {
    return PROPERTY_FIELD_LABELS[property] ?? recipientFilterPropertyLabel(property)
  }

  function propertyTypeLabel(propertyType: string): string {
    return PROPERTY_TYPE_LABELS[propertyType] ?? recipientFilterPropertyTypeLabel(propertyType)
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

  /** Column label for the filter row (admin UI uses “Type or sub type” for contact profile). */
  function matchRuleFieldLabel(row: RecipientListFilterRow): string {
    const f = rowFilter(row)
    if (f?.property === 'contact_profile') return 'Type or sub type'
    return 'Field'
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
    const groups = form.filterGroups
      .map((group) => {
        const rows = group.rows
          .filter((r) => r.recipientFilterId.trim())
          .map((r) => ({
            recipientFilterId: r.recipientFilterId.trim(),
            listPropertyValue: r.listPropertyValue.trim()
          }))
        const need = Math.max(0, rows.length - 1)
        return { rows, joins: group.joins.slice(0, need) }
      })
      .filter((group) => group.rows.length > 0)
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      audience: form.audience,
      filterRows: groups.flatMap((group) => group.rows),
      filterGroups: groups,
      groupJoins: form.groupJoins.slice(0, Math.max(0, groups.length - 1)),
      filterMode: form.filterMode
    }
    if (groups.length === 1) body.criterionJoins = groups[0]!.joins
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
    const joinsFor = (
      rows: { recipientFilterId: string }[],
      api: ('and' | 'or')[] | undefined,
      useFilterMode: boolean
    ): RecipientListJoinChoice[] => {
      const filled = rows.filter((r) => r.recipientFilterId.trim()).length
      const need = Math.max(0, filled - 1)
      const joins: RecipientListJoinChoice[] = []
      for (let i = 0; i < need; i++) {
        if (Array.isArray(api) && (api[i] === 'or' || api[i] === 'and')) {
          joins.push(api[i] === 'or' ? 'or' : 'and')
        } else if (useFilterMode && need === 1 && list.filterMode === 'or') {
          joins.push('or')
        } else {
          joins.push('')
        }
      }
      return joins
    }
    const savedGroups: RecipientListFilterGroup[] = list.filterGroups?.length
      ? list.filterGroups.map((group) => {
          const rows = group.rows.map((r) => ({
            recipientFilterId: String(r.recipientFilterId ?? '').trim(),
            listPropertyValue: String(r.listPropertyValue ?? '').trim()
          }))
          return { rows, joins: joinsFor(rows, group.joins, false) }
        })
      : [
          {
            rows: (list.filterRows ?? []).map((r) => ({
              recipientFilterId: String(r.recipientFilterId ?? '').trim(),
              listPropertyValue: String(r.listPropertyValue ?? '').trim()
            })),
            joins: joinsFor(
              (list.filterRows ?? []).map((r) => ({
                recipientFilterId: String(r.recipientFilterId ?? '').trim()
              })),
              list.criterionJoins,
              true
            )
          }
        ]
    form.filterGroups.splice(0, form.filterGroups.length, ...savedGroups.filter((g) => g.rows.length))
    form.groupJoins.splice(0, form.groupJoins.length)
    const savedGroupJoins = list.groupJoins ?? []
    for (let i = 0; i < Math.max(0, form.filterGroups.length - 1); i++) {
      form.groupJoins.push(savedGroupJoins[i] === 'or' ? 'or' : savedGroupJoins[i] === 'and' ? 'and' : '')
    }
    form.filterRows = form.filterGroups.flatMap((group) => group.rows)
    for (const row of form.filterRows) {
      const f = rowFilter(row)
      if (!f || f.property === 'none') continue
      const tokens = filterTokens(f)
      /** A lone token is shown read-only, so the saved value has to track it — including rows
       * stored back when a comma in a single-value filter still split it into several tokens. */
      if (tokens.length === 1) {
        row.listPropertyValue = tokens[0] ?? ''
      }
    }

  }

  async function loadFormPayload(): Promise<void> {
    const res = await $fetch<RecipientListFormPayload>('/api/v1/tenant/recipient-list', {
      credentials: 'include',
      ...serverAuthHeaders(),
      query: { scope: 'form' }
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
          ...serverAuthHeaders(),
          query: { scope: 'form' }
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
    if (!canSubmitForm.value) return
    saving.value = true
    try {
      await $fetch(`/api/v1/tenant/recipient-list/${encodeURIComponent(listId)}`, {
        method: 'PATCH',
        credentials: 'include',
        ...serverAuthHeaders(),
        body: buildSaveBody()
      })
      clearNuxtPayloadCache(TENANT_RECIPIENT_LIST_INDEX_CACHE_KEY)
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
    audienceFieldSelectOptions,
    filtersForAudience,
    canAddFilter,
    showPropertyRowFor,
    rowRegistryTokens,
    propertyValuePlaceholderFor,
    showCombineBeforeFormRow,
    joinSlotBeforeFormRow,
    conditionNumber,
    conditionCount,
    conditionSummary,
    filterPreview,
    addFilterGroup,
    removeFilterGroup,
    canSubmitForm,
    submitBlockReasons,
    recipientFilterSelectOptions,
    registryValueSelectOptions,
    onRowFilterChange,
    addFilterRow,
    removeFilterRow,
    filterOptionLabel,
    matchRuleFieldLabel,
    rowRegistryValueDisplay
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
