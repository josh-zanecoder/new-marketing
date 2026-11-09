import { dedupeByNormalizedEmailKeepFirst } from '~~/shared/dedupeByNormalizedEmail'

/**
 * LO-recipient-list toggle path only — page size for `/lo-borrowers` preview.
 * Classic recipient-list form does not use this.
 * Use the server max to cut round-trips when an LO has many borrowers.
 */
export const LO_BORROWERS_PREVIEW_PAGE_SIZE = 200

/** Server hard cap per request (must stay in sync with lo-borrowers.get.ts). */
export const LO_BORROWERS_PREVIEW_MAX_LIMIT = 200

/** Max pages for one LO checklist load (pageSize 200 → 10k rows). */
export const LO_BORROWERS_PREVIEW_MAX_PAGES = 50

export type LoBorrowerPreviewPageRow = {
  id: string
  name: string
  email: string
}

export type LoBorrowerPreviewPageResult = {
  total: number
  borrowers: LoBorrowerPreviewPageRow[]
}

/**
 * Whether another page should be requested when loading the full LO borrower checklist.
 * Advance by requested `pageSize` (raw skip), not deduped row count.
 */
export function shouldFetchMoreLoBorrowers(params: {
  skipAfterPage: number
  total: number
  lastPageCount: number
  pageSize: number
}): boolean {
  const { skipAfterPage, total, lastPageCount, pageSize } = params
  if (lastPageCount <= 0) return false
  if (!Number.isFinite(total) || total <= 0) return false
  if (lastPageCount < pageSize) return false
  return skipAfterPage < total
}

export type LoadAllLoBorrowerPagesResult = {
  total: number
  borrowers: LoBorrowerPreviewPageRow[]
  pagesFetched: number
}

/**
 * Pages `/lo-borrowers` until every borrower for the LO is collected (toggle path only).
 * Optional `onPage` enables progressive UI (show first page, then append).
 */
export async function loadAllLoBorrowerPages(params: {
  pageSize?: number
  maxPages?: number
  fetchPage: (args: {
    skip: number
    limit: number
  }) => Promise<LoBorrowerPreviewPageResult>
  /** Called after each page with the cumulative unique (pre-final-dedupe) rows. */
  onPage?: (info: {
    pageIndex: number
    pageRows: LoBorrowerPreviewPageRow[]
    accumulated: LoBorrowerPreviewPageRow[]
    totalHint: number
    done: boolean
  }) => void | Promise<void>
}): Promise<LoadAllLoBorrowerPagesResult> {
  const pageSize = params.pageSize ?? LO_BORROWERS_PREVIEW_PAGE_SIZE
  const maxPages = params.maxPages ?? LO_BORROWERS_PREVIEW_MAX_PAGES
  const allRows: LoBorrowerPreviewPageRow[] = []
  const seenIds = new Set<string>()
  let skip = 0
  let pagesFetched = 0

  if (maxPages <= 0) {
    return { total: 0, borrowers: [], pagesFetched: 0 }
  }

  let total!: number
  for (let page = 0; page < maxPages; page++) {
    const res = await params.fetchPage({ skip, limit: pageSize })
    pagesFetched += 1
    total = Number(res.total) || 0
    const rows = Array.isArray(res.borrowers) ? res.borrowers : []
    const pageRows: LoBorrowerPreviewPageRow[] = []
    for (const row of rows) {
      if (!row?.id || seenIds.has(row.id)) continue
      seenIds.add(row.id)
      allRows.push(row)
      pageRows.push(row)
    }
    skip += pageSize
    const more = shouldFetchMoreLoBorrowers({
      skipAfterPage: skip,
      total,
      lastPageCount: rows.length,
      pageSize
    })
    if (params.onPage) {
      await params.onPage({
        pageIndex: page,
        pageRows,
        // Email-dedupe as we go so progressive UI matches final checklist rows.
        accumulated: dedupeByNormalizedEmailKeepFirst(allRows),
        totalHint: total,
        done: !more
      })
    }
    if (!more) break
  }

  // LO flag path: one checklist row per email (duplicate Contact docs collapse).
  const borrowers = dedupeByNormalizedEmailKeepFirst(allRows)

  return {
    total: borrowers.length,
    borrowers,
    pagesFetched
  }
}
