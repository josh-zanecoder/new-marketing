/** Normalize a category display name for storage and uniqueness checks. */
export function normalizeEmailTemplateCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export type EmailTemplateCategoryFilterValue = 'all' | 'uncategorized' | string

/** Whether a template row matches the category filter dropdown value. */
export function matchesEmailTemplateCategoryFilter(
  categoryId: string | null | undefined,
  filter: EmailTemplateCategoryFilterValue
): boolean {
  if (filter === 'all') return true
  const id = typeof categoryId === 'string' ? categoryId.trim() : ''
  if (filter === 'uncategorized') return !id
  return id === filter
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
    { value: 'all', label: 'All categories' },
    { value: 'uncategorized', label: 'Uncategorized' },
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
