import { toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

export interface ClientPaginationMeta {
  from: number
  to: number
  total: number
}

export function useClientPagination<T>(
  items: Ref<T[]> | ComputedRef<T[]>,
  pageSize: MaybeRefOrGetter<number> = 10
) {
  const currentPage = ref(1)
  const pageInput = ref('1')

  const resolvedPageSize = computed(() => Math.max(1, toValue(pageSize)))

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(items.value.length / resolvedPageSize.value))
  )

  const paginatedItems = computed(() => {
    const size = resolvedPageSize.value
    const start = (currentPage.value - 1) * size
    return items.value.slice(start, start + size)
  })

  const paginationMeta = computed((): ClientPaginationMeta => {
    const total = items.value.length
    const size = resolvedPageSize.value
    if (!total) return { from: 0, to: 0, total: 0 }
    const from = (currentPage.value - 1) * size + 1
    const to = Math.min(currentPage.value * size, total)
    return { from, to, total }
  })

  watch(
    currentPage,
    (page) => {
      pageInput.value = String(page)
    },
    { immediate: true }
  )

  function commitPageInput() {
    const parsed = Number.parseInt(pageInput.value.trim(), 10)
    if (!Number.isFinite(parsed)) {
      pageInput.value = String(currentPage.value)
      return
    }
    currentPage.value = Math.min(totalPages.value, Math.max(1, parsed))
    pageInput.value = String(currentPage.value)
  }

  watch(
    () => items.value.length,
    () => {
      currentPage.value = 1
    }
  )

  watch(resolvedPageSize, () => {
    currentPage.value = 1
  })

  watch(totalPages, (pages) => {
    if (currentPage.value > pages) currentPage.value = pages
  })

  return {
    currentPage,
    totalPages,
    paginatedItems,
    paginationMeta,
    pageSize: resolvedPageSize,
    pageInput,
    commitPageInput
  }
}
