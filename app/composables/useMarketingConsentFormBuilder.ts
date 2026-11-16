import {
  CONSENT_BUILDER_COPY,
  CONSENT_BUILDER_SECTIONS,
  CONSENT_BUILDER_STORAGE_KEY,
  CONSENT_SECTION_PALETTE_KINDS,
  createConsentField,
  emptyConsentDocument,
  fieldsInSection,
  kindNeedsOptions,
  parseConsentDocument,
  reorderConsentFields,
  type ConsentBuilderField,
  type ConsentBuilderSection,
  type ConsentFieldKind
} from '~~/shared/consentFormBuilder'

export function useMarketingConsentFormBuilder() {
  const toast = useAppToast()
  const fields = ref<ConsentBuilderField[]>([])
  const savedSnapshot = ref('')
  const activeSection = ref<ConsentBuilderSection>('health')
  const selectedKey = ref<string | null>(null)
  const saving = ref(false)
  const success = ref('')
  let successTimer = 0

  const snapshot = () => JSON.stringify(fields.value)
  const dirty = computed(() => snapshot() !== savedSnapshot.value)
  const sectionFields = computed(() => fieldsInSection(fields.value, activeSection.value))
  const selectedField = computed(
    () => fields.value.find((f) => f.key === selectedKey.value) ?? null
  )
  const paletteKinds = computed(
    () => CONSENT_SECTION_PALETTE_KINDS[activeSection.value] ?? []
  )

  function load() {
    if (!import.meta.client) return
    try {
      const raw = window.localStorage.getItem(CONSENT_BUILDER_STORAGE_KEY)
      const parsed = raw ? parseConsentDocument(JSON.parse(raw)) : null
      fields.value = parsed?.fields ?? emptyConsentDocument().fields
    } catch {
      fields.value = []
    }
    savedSnapshot.value = snapshot()
  }

  function setActiveSection(section: ConsentBuilderSection) {
    activeSection.value = section
    selectedKey.value = null
  }

  function selectField(key: string) {
    selectedKey.value = key
  }

  function addField(kind: ConsentFieldKind) {
    const allowed = CONSENT_SECTION_PALETTE_KINDS[activeSection.value]
    if (!allowed.includes(kind)) return
    const next = createConsentField(
      kind,
      activeSection.value,
      fields.value.map((f) => f.key)
    )
    fields.value = [...fields.value, next]
    selectedKey.value = next.key
  }

  function updateSelected(patch: Partial<ConsentBuilderField>) {
    const key = selectedKey.value
    if (!key) return
    fields.value = fields.value.map((f) => {
      if (f.key !== key) return f
      const next = { ...f, ...patch, key: f.key, kind: f.kind, section: f.section }
      if (!kindNeedsOptions(next.kind)) next.options = []
      return next
    })
  }

  function addChoice() {
    const field = selectedField.value
    if (!field || !kindNeedsOptions(field.kind)) return
    const n = field.options.length + 1
    updateSelected({
      options: [...field.options, { id: `option_${n}`, label: `Option ${n}` }]
    })
  }

  function updateChoice(index: number, label: string) {
    const field = selectedField.value
    if (!field) return
    updateSelected({
      options: field.options.map((o, i) => (i === index ? { ...o, label } : o))
    })
  }

  function removeChoice(index: number) {
    const field = selectedField.value
    if (!field) return
    updateSelected({ options: field.options.filter((_, i) => i !== index) })
  }

  function deleteSelected() {
    const key = selectedKey.value
    if (!key) return
    fields.value = fields.value.filter((f) => f.key !== key)
    selectedKey.value = null
    toast.success('Question removed. Click Save to keep this change.')
  }

  function moveField(fromKey: string, toKey: string) {
    fields.value = reorderConsentFields(fields.value, activeSection.value, fromKey, toKey)
  }

  async function save() {
    if (saving.value) return
    saving.value = true
    success.value = ''
    try {
      const doc = {
        version: 1 as const,
        fields: fields.value,
        updatedAt: new Date().toISOString()
      }
      window.localStorage.setItem(CONSENT_BUILDER_STORAGE_KEY, JSON.stringify(doc))
      savedSnapshot.value = snapshot()
      success.value = CONSENT_BUILDER_COPY.SAVE_SUCCESS
      toast.success(CONSENT_BUILDER_COPY.SAVE_SUCCESS)
      window.clearTimeout(successTimer)
      successTimer = window.setTimeout(() => {
        success.value = ''
      }, 3000)
    } finally {
      saving.value = false
    }
  }

  function discard() {
    load()
    selectedKey.value = null
    success.value = ''
  }

  onBeforeUnmount(() => window.clearTimeout(successTimer))

  return {
    sections: CONSENT_BUILDER_SECTIONS,
    fields,
    activeSection,
    selectedKey,
    selectedField,
    sectionFields,
    paletteKinds,
    dirty,
    saving,
    success,
    load,
    setActiveSection,
    selectField,
    addField,
    updateSelected,
    addChoice,
    updateChoice,
    removeChoice,
    deleteSelected,
    moveField,
    save,
    discard
  }
}
