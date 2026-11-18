export type FlyerGroupItem = {
  id: string
  name: string
  categoryId?: string | null
  categoryName?: string | null
  imageUrl: string
  contentType?: string
  fileName?: string
  createdAt?: string | null
}

export type FlyerCategoryGroup = {
  key: string
  label: string
  categoryId: string | null
  items: FlyerGroupItem[]
}

const UNCATEGORIZED_KEY = 'uncategorized'

/**
 * Group flyers into category sections.
 * Named categories keep list sort order; uncategorized is last.
 */
export function groupFlyersByCategory(
  flyers: ReadonlyArray<FlyerGroupItem>,
  categories: ReadonlyArray<{ id: string; name: string; sortOrder?: number }>
): FlyerCategoryGroup[] {
  const categoryOrder = [...categories].sort((a, b) => {
    const ao = typeof a.sortOrder === 'number' ? a.sortOrder : 0
    const bo = typeof b.sortOrder === 'number' ? b.sortOrder : 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  const groups = new Map<string, FlyerCategoryGroup>()
  for (const category of categoryOrder) {
    groups.set(category.id, {
      key: category.id,
      label: category.name,
      categoryId: category.id,
      items: []
    })
  }
  groups.set(UNCATEGORIZED_KEY, {
    key: UNCATEGORIZED_KEY,
    label: 'Uncategorized',
    categoryId: null,
    items: []
  })

  for (const flyer of flyers) {
    const categoryId = typeof flyer.categoryId === 'string' ? flyer.categoryId.trim() : ''
    const key = categoryId && groups.has(categoryId) ? categoryId : UNCATEGORIZED_KEY
    const group = groups.get(key)
    if (!group) continue
    group.items.push(flyer)
  }

  return [...groups.values()].filter((group) => {
    if (group.key === UNCATEGORIZED_KEY) return group.items.length > 0
    return true
  })
}
