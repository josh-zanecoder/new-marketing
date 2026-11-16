/**
 * DigiKard Consent Form Builder — Marketing port.
 * Mirrors digikard/lib/constants/consent-form-builder.ts for the question-canvas UX.
 */

export const CONSENT_BUILDER_STORAGE_KEY = 'marketing-consent-form-builder-v1'

export const CONSENT_FIELD_KINDS = [
  'text',
  'textarea',
  'number',
  'radio',
  'yes_no',
  'multi_select',
  'checkbox',
  'date',
  'file',
  'display'
] as const

export type ConsentFieldKind = (typeof CONSENT_FIELD_KINDS)[number]

export const CONSENT_BUILDER_SECTIONS = [
  'client_info',
  'health',
  'service_details',
  'patch_test'
] as const

export type ConsentBuilderSection = (typeof CONSENT_BUILDER_SECTIONS)[number]

export type ConsentFieldOption = { id: string; label: string }

export type ConsentBuilderField = {
  key: string
  kind: ConsentFieldKind
  section: ConsentBuilderSection
  label: string
  helpText: string
  required: boolean
  options: ConsentFieldOption[]
  order: number
}

export const CONSENT_FIELD_KIND_LABELS: Record<ConsentFieldKind, string> = {
  text: 'Short text',
  textarea: 'Paragraph',
  number: 'Number',
  radio: 'Multiple choice',
  yes_no: 'Yes / No',
  multi_select: 'Checklist',
  checkbox: 'Checkbox',
  date: 'Date',
  file: 'File upload',
  display: 'Read-only info'
}

export const CONSENT_SECTION_LABELS: Record<ConsentBuilderSection, string> = {
  client_info: 'Client information',
  health: 'Health questions',
  service_details: 'Service details',
  patch_test: 'Patch test'
}

/** Palette kinds per section (DigiKard BUILDER_SECTION_PALETTE_KINDS, simplified). */
export const CONSENT_SECTION_PALETTE_KINDS: Record<ConsentBuilderSection, readonly ConsentFieldKind[]> = {
  client_info: ['text', 'textarea', 'number', 'radio', 'yes_no', 'multi_select', 'checkbox', 'date', 'file'],
  health: ['text', 'textarea', 'number', 'radio', 'yes_no', 'multi_select', 'checkbox', 'date', 'file'],
  service_details: ['text', 'textarea', 'number', 'radio', 'yes_no', 'multi_select', 'checkbox', 'date', 'file'],
  patch_test: ['display', 'text', 'checkbox']
}

export const CONSENT_BUILDER_COPY = {
  PAGE_TITLE: 'Consent form builder',
  PAGE_SUBTITLE: 'Choose a section to edit questions. Drag field types onto the canvas, reorder, then save.',
  PALETTE_TITLE: 'Field types',
  PALETTE_HINT: 'Drag a field onto the canvas to add it, or click to add.',
  CANVAS_TITLE: 'Form preview',
  CANVAS_HINT: 'Drag to reorder. Click a question to edit its settings.',
  DETAILS_TITLE: 'Field settings',
  DETAILS_EMPTY: 'Select a question on the canvas to edit its settings.',
  EMPTY_CANVAS: 'Drag a field here from the left panel to add your first question.',
  SECTIONS_TITLE: 'Form sections',
  UNSAVED: 'Unsaved changes',
  SAVE: 'Save',
  SAVING: 'Saving…',
  SAVE_SUCCESS: 'Form template saved.',
  DELETE: 'Delete',
  REQUIRED: 'Required',
  LABEL: 'Label',
  HELP: 'Help text (optional)',
  OPTIONS: 'Choices',
  ADD_CHOICE: 'Add choice',
  DRAG_HANDLE: 'Drag to reorder'
} as const

export function consentFieldKindLabel(kind: string): string {
  return CONSENT_FIELD_KIND_LABELS[kind as ConsentFieldKind] ?? kind
}

export function consentSectionLabel(section: string): string {
  return CONSENT_SECTION_LABELS[section as ConsentBuilderSection] ?? section
}

export function kindNeedsOptions(kind: ConsentFieldKind): boolean {
  return kind === 'radio' || kind === 'multi_select'
}

export function defaultOptionsForKind(kind: ConsentFieldKind): ConsentFieldOption[] {
  if (kind === 'radio' || kind === 'yes_no') {
    return [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' }
    ]
  }
  if (kind === 'multi_select') {
    return [
      { id: 'option_1', label: 'Option 1' },
      { id: 'option_2', label: 'Option 2' }
    ]
  }
  return []
}

export function defaultLabelForKind(kind: ConsentFieldKind): string {
  if (kind === 'display') return 'Read-only info'
  if (kind === 'checkbox') return 'Checkbox label'
  return 'Untitled question'
}

let keySeq = 0

export function createConsentField(
  kind: ConsentFieldKind,
  section: ConsentBuilderSection,
  existingKeys: string[]
): ConsentBuilderField {
  keySeq += 1
  let key = `${kind}_${keySeq}`
  while (existingKeys.includes(key)) {
    keySeq += 1
    key = `${kind}_${keySeq}`
  }
  return {
    key,
    kind,
    section,
    label: defaultLabelForKind(kind),
    helpText: kind === 'display' ? 'Enter read-only text for the client form.' : '',
    required: kind !== 'display',
    options: defaultOptionsForKind(kind),
    order: Date.now()
  }
}

export function reorderConsentFields(
  fields: ConsentBuilderField[],
  section: ConsentBuilderSection,
  fromKey: string,
  toKey: string
): ConsentBuilderField[] {
  if (fromKey === toKey) return fields
  const sectionItems = fields.filter((f) => f.section === section)
  const others = fields.filter((f) => f.section !== section)
  const from = sectionItems.findIndex((f) => f.key === fromKey)
  const to = sectionItems.findIndex((f) => f.key === toKey)
  if (from < 0 || to < 0) return fields
  const next = [...sectionItems]
  const [moved] = next.splice(from, 1)
  if (!moved) return fields
  next.splice(to, 0, moved)
  return [...others, ...next.map((f, i) => ({ ...f, order: (i + 1) * 10 }))]
}

export function fieldsInSection(
  fields: ConsentBuilderField[],
  section: ConsentBuilderSection
): ConsentBuilderField[] {
  return fields
    .filter((f) => f.section === section)
    .slice()
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
}

export type ConsentBuilderDocument = {
  version: 1
  fields: ConsentBuilderField[]
  updatedAt: string
}

export function emptyConsentDocument(): ConsentBuilderDocument {
  return { version: 1, fields: [], updatedAt: new Date().toISOString() }
}

export function parseConsentDocument(raw: unknown): ConsentBuilderDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as { version?: unknown; fields?: unknown }
  if (doc.version !== 1 || !Array.isArray(doc.fields)) return null
  const fields: ConsentBuilderField[] = []
  for (const item of doc.fields) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const kind = String(f.kind ?? '')
    const section = String(f.section ?? '')
    if (!(CONSENT_FIELD_KINDS as readonly string[]).includes(kind)) continue
    if (!(CONSENT_BUILDER_SECTIONS as readonly string[]).includes(section)) continue
    const key = String(f.key ?? '').trim()
    if (!key) continue
    fields.push({
      key,
      kind: kind as ConsentFieldKind,
      section: section as ConsentBuilderSection,
      label: String(f.label ?? 'Untitled question'),
      helpText: String(f.helpText ?? ''),
      required: f.required === true,
      options: Array.isArray(f.options)
        ? f.options
          .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
          .map((o, i) => ({
            id: String(o.id ?? `opt_${i + 1}`),
            label: String(o.label ?? `Option ${i + 1}`)
          }))
        : [],
      order: typeof f.order === 'number' ? f.order : fields.length * 10
    })
  }
  return { version: 1, fields, updatedAt: new Date().toISOString() }
}
