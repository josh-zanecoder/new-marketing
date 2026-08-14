import {
  EMAIL_TEMPLATE_CATEGORY_FILTER_ALL,
  EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED,
  EMAIL_TEMPLATE_CATEGORY_QUERY_KEY,
  EMAIL_TEMPLATES_LIST_PATH
} from '~~/shared/constants/emailTemplateCategory'

/** Normalize a category display name for storage and uniqueness checks. */
export function normalizeEmailTemplateCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export type EmailTemplateCategoryFilterValue =
  | typeof EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
  | typeof EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED
  | string

/** Whether a template row matches the category filter dropdown value. */
export function matchesEmailTemplateCategoryFilter(
  categoryId: string | null | undefined,
  filter: EmailTemplateCategoryFilterValue
): boolean {
  if (filter === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL) return true
  const id = typeof categoryId === 'string' ? categoryId.trim() : ''
  if (filter === EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED) return !id
  return id === filter
}

/** Parse `?category=` from the email templates list route. */
export function parseEmailTemplateCategoryFilterQuery(raw: unknown): EmailTemplateCategoryFilterValue {
  if (typeof raw !== 'string') return EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
  const trimmed = raw.trim()
  if (!trimmed || trimmed === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL) {
    return EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
  }
  return trimmed
}

/** Deep-link to the email templates library, optionally filtered by category. */
export function buildEmailTemplatesListHref(
  categoryFilter: EmailTemplateCategoryFilterValue = EMAIL_TEMPLATE_CATEGORY_FILTER_ALL
): string {
  if (categoryFilter === EMAIL_TEMPLATE_CATEGORY_FILTER_ALL) return EMAIL_TEMPLATES_LIST_PATH
  const query = `${EMAIL_TEMPLATE_CATEGORY_QUERY_KEY}=${encodeURIComponent(categoryFilter)}`
  return `${EMAIL_TEMPLATES_LIST_PATH}?${query}`
}

export type EmailTemplateCategorySelectOption = {
  value: string
  label: string
}

/** Build filter dropdown options: All, Uncategorized, then named categories. */
export function buildEmailTemplateCategoryFilterOptions(
  categories: ReadonlyArray<{ id: string; name: string }>
): EmailTemplateCategorySelectOption[] {
  return [
    { value: EMAIL_TEMPLATE_CATEGORY_FILTER_ALL, label: 'All categories' },
    { value: EMAIL_TEMPLATE_CATEGORY_FILTER_UNCATEGORIZED, label: 'Uncategorized' },
    ...categories.map((c) => ({ value: c.id, label: c.name }))
  ]
}

/** Build assign dropdown options for create/edit: none + categories. */
export function buildEmailTemplateCategoryAssignOptions(
  categories: ReadonlyArray<{ id: string; name: string }>
): EmailTemplateCategorySelectOption[] {
  return [
    { value: '', label: 'No category' },
    ...categories.map((c) => ({ value: c.id, label: c.name }))
  ]
}
