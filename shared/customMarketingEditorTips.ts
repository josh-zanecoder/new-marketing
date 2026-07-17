/** Tip copy for the Custom Marketing write-message surface. */

export type CustomMarketingEditorTipDef = {
  id: string
  title: string
  body: string
  example?: string
}

export const CUSTOM_MARKETING_EDITOR_TIPS_HEADING = 'Quick tips'

export const CUSTOM_MARKETING_EDITOR_TIPS: readonly CustomMarketingEditorTipDef[] = [
  {
    id: 'preview',
    title: 'Preview',
    body: 'Open the browser + Gmail view. Merge tags fill from the first contact on the selected list.'
  },
  {
    id: 'variables',
    title: 'Variables',
    body: 'Use Insert variable ({} toolbar button) to add merge tags.',
    example: '{{ recipient.firstName }}'
  },
  {
    id: 'photos',
    title: 'Photos',
    body: 'Compressed for Gmail. Select a photo to resize or align; use trash to remove. Uploads work before a list is chosen.'
  },
  {
    id: 'layout',
    title: 'Layout',
    body: 'Use Two columns for a fixed side-by-side layout. Trash on a photo or column block removes it.'
  }
]
