import { describe, expect, it } from 'vitest'
import {
  createConsentField,
  fieldsInSection,
  parseConsentDocument,
  reorderConsentFields
} from './consentFormBuilder'

describe('consentFormBuilder', () => {
  it('creates a field in the active section with a unique key', () => {
    const field = createConsentField('text', 'health', [])
    expect(field.section).toBe('health')
    expect(field.kind).toBe('text')
    expect(field.key).toMatch(/^text_/)
  })

  it('reorders fields only within the same section', () => {
    const a = createConsentField('text', 'health', [])
    const b = createConsentField('textarea', 'health', [a.key])
    const c = createConsentField('checkbox', 'service_details', [a.key, b.key])
    const next = reorderConsentFields([a, b, c], 'health', b.key, a.key)
    expect(fieldsInSection(next, 'health').map((f) => f.key)).toEqual([b.key, a.key])
    expect(fieldsInSection(next, 'service_details').map((f) => f.key)).toEqual([c.key])
  })

  it('parses a saved document and drops invalid fields', () => {
    const parsed = parseConsentDocument({
      version: 1,
      fields: [
        { key: 'q1', kind: 'text', section: 'health', label: 'Allergies', required: true, options: [], order: 10 },
        { key: 'bad', kind: 'nope', section: 'health', label: 'X' }
      ]
    })
    expect(parsed?.fields).toHaveLength(1)
    expect(parsed?.fields[0]?.label).toBe('Allergies')
  })
})
