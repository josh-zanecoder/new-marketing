import { mergeMustacheTemplate } from './utils/emailTemplateMerge'

/** Pure helpers for the write-message Preview modal (browser + Gmail chrome). */

export function shouldCloseCustomMarketingMessagePreview(
  key: string,
  previewOpen: boolean
): boolean {
  return key === 'Escape' && previewOpen
}

/** Apply merge only when a recipient list is selected (otherwise keep raw `{{tags}}`). */
export function shouldApplyCustomMarketingPreviewMerge(recipientListId: string): boolean {
  return recipientListId.trim().length > 0
}

/** Fills `{{…}}` from the first-list-recipient merge root when a list is selected. */
export function renderCustomMarketingPreviewTemplate(
  template: string,
  mergeRoot: Record<string, unknown>,
  recipientListId: string
): string {
  if (!shouldApplyCustomMarketingPreviewMerge(recipientListId)) return template
  return mergeMustacheTemplate(template, mergeRoot)
}
