/**
 * DigiKard public-card styles, mirrored from digikard/lib/constants/templates.ts
 * so Marketing can pick and preview the same layouts.
 */

export const DIGIKARD_TEMPLATE_IDS = {
  CLASSIC: 'template1',
  PREMIUM: 'template4',
  AURA: 'template5',
  REEF: 'template6',
  LEVU: 'template7'
} as const

export type DigikardTemplateId =
  (typeof DIGIKARD_TEMPLATE_IDS)[keyof typeof DIGIKARD_TEMPLATE_IDS]

export const DIGIKARD_TEMPLATES: Array<{
  id: DigikardTemplateId
  name: string
  preview: string
}> = [
  {
    id: DIGIKARD_TEMPLATE_IDS.CLASSIC,
    name: 'Classic',
    preview: 'Light card layout with teal accents'
  },
  {
    id: DIGIKARD_TEMPLATE_IDS.PREMIUM,
    name: 'Premium',
    preview: 'Dark gradient hero'
  },
  {
    id: DIGIKARD_TEMPLATE_IDS.AURA,
    name: 'Aura',
    preview: 'Ultra-modern dark with glass & amber'
  },
  {
    id: DIGIKARD_TEMPLATE_IDS.REEF,
    name: 'Reef',
    preview: 'Teal/bluish dark, sharp & minimal'
  },
  {
    id: DIGIKARD_TEMPLATE_IDS.LEVU,
    name: 'Lévu',
    preview: 'Retro 70s wavy checkerboard — brown & blush'
  }
]

export function normalizeDigikardTemplateId(raw: string | null | undefined): DigikardTemplateId {
  const id = String(raw ?? '').trim()
  if (DIGIKARD_TEMPLATES.some((t) => t.id === id)) return id as DigikardTemplateId
  return DIGIKARD_TEMPLATE_IDS.CLASSIC
}

export const DIGIKARD_SAMPLE_CARD = {
  name: 'Alex Rivera',
  title: 'Esthetician & Brow Artist',
  city: 'Los Angeles, CA',
  email: 'alex@example.com',
  phone: '(310) 555-0142'
} as const
