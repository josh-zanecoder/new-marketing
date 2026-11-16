import { describe, expect, it } from 'vitest'
import {
  DIGIKARD_TEMPLATES,
  DIGIKARD_TEMPLATE_IDS,
  normalizeDigikardTemplateId
} from './digikardTemplates'

describe('digikardTemplates', () => {
  it('lists the five DigiKard card styles', () => {
    expect(DIGIKARD_TEMPLATES.map((t) => t.id)).toEqual([
      DIGIKARD_TEMPLATE_IDS.CLASSIC,
      DIGIKARD_TEMPLATE_IDS.PREMIUM,
      DIGIKARD_TEMPLATE_IDS.AURA,
      DIGIKARD_TEMPLATE_IDS.REEF,
      DIGIKARD_TEMPLATE_IDS.LEVU
    ])
  })

  it('falls back to Classic for unknown ids', () => {
    expect(normalizeDigikardTemplateId('template2')).toBe(DIGIKARD_TEMPLATE_IDS.CLASSIC)
    expect(normalizeDigikardTemplateId(undefined)).toBe(DIGIKARD_TEMPLATE_IDS.CLASSIC)
    expect(normalizeDigikardTemplateId('template5')).toBe(DIGIKARD_TEMPLATE_IDS.AURA)
  })
})
