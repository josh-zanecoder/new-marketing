/**
 * LO-recipient-list toggle path only — page size for `/lo-borrowers` preview.
 * Classic recipient-list form does not use this.
 */
export const LO_BORROWERS_PREVIEW_PAGE_SIZE = 100

/** Server hard cap per request (must stay in sync with lo-borrowers.get.ts). */
export const LO_BORROWERS_PREVIEW_MAX_LIMIT = 200

/** Max pages for one LO checklist load (pageSize 100 → 5k rows). */
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
 */
export function shouldFetchMoreLoBorrowers(params: {
  loadedCount: number
  total: number
  lastPageCount: number
}): boolean {
  const { loadedCount, total, lastPageCount } = params
  if (lastPageCount <= 0) return false
  if (!Number.isFinite(total) || total <= 0) return false
  return loadedCount < total
}

/**
 * Pages `/lo-borrowers` until every borrower for the LO is collected (toggle path only).
 */
export async function loadAllLoBorrowerPages(params: {
  pageSize?: number
  maxPages?: number
  fetchPage: (args: {
    skip: number
    limit: number
  }) => Promise<LoBorrowerPreviewPageResult>
}): Promise<{ total: number; borrowers: LoBorrowerPreviewPageRow[]; pagesFetched: number }> {
  const pageSize = params.pageSize ?? LO_BORROWERS_PREVIEW_PAGE_SIZE
  const maxPages = params.maxPages ?? LO_BORROWERS_PREVIEW_MAX_PAGES
  const allRows: LoBorrowerPreviewPageRow[] = []
  const seen = new Set<string>()
  let total = 0
  let skip = 0
  let pagesFetched = 0

  for (let page = 0; page < maxPages; page++) {
    const res = await params.fetchPage({ skip, limit: pageSize })
    pagesFetched += 1
    total = Number(res.total) || 0
    const rows = Array.isArray(res.borrowers) ? res.borrowers : []
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue
      seen.add(row.id)
      allRows.push(row)
    }
    skip += rows.length
    if (
      !shouldFetchMoreLoBorrowers({
        loadedCount: allRows.length,
        total,
        lastPageCount: rows.length
      })
    ) {
      break
    }
  }

  return {
    total: Math.max(total, allRows.length),
    borrowers: allRows,
    pagesFetched
  }
}
