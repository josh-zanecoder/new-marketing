import type { ComputedRef, Ref } from 'vue'

export interface ClientPaginationMeta {
  from: number
  to: number
  total: number
}

export function useClientPagination<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  pageSize = 10
) {
  const currentPage = ref(1)

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(items.value.length / pageSize))
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return items.value.slice(start, start + pageSize)
  })

  const paginationMeta = computed((): ClientPaginationMeta => {
    const total = items.value.length
    if (!total) return { from: 0, to: 0, total: 0 }
    const from = (currentPage.value - 1) * pageSize + 1
    const to = Math.min(currentPage.value * pageSize, total)
    return { from, to, total }
  })

  watch(
    () => items.value.length,
    () => {
      currentPage.value = 1
    }
  )

  watch(totalPages, (pages) => {
    if (currentPage.value > pages) currentPage.value = pages
  })

  return {
    currentPage,
    totalPages,
    paginatedItems,
    paginationMeta,
    pageSize
  }
}
