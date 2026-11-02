import { describe, expect, it, vi } from 'vitest'
import {
  LO_BORROWERS_PREVIEW_MAX_LIMIT,
  LO_BORROWERS_PREVIEW_PAGE_SIZE,
  loadAllLoBorrowerPages,
  shouldFetchMoreLoBorrowers,
  type LoBorrowerPreviewPageRow
} from './loBorrowersPreviewPage'

function makeBorrowers(count: number): LoBorrowerPreviewPageRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i + 1}`,
    name: `Borrower ${i + 1}`,
    email: `b${i + 1}@example.com`
  }))
}

describe('loBorrowersPreviewPage (LO-list toggle path)', () => {
  it('uses a page size above the previous 50-cap so multi-page loads can finish', () => {
    expect(LO_BORROWERS_PREVIEW_PAGE_SIZE).toBeGreaterThan(50)
    expect(LO_BORROWERS_PREVIEW_MAX_LIMIT).toBeGreaterThanOrEqual(LO_BORROWERS_PREVIEW_PAGE_SIZE)
  })

  it('keeps fetching until loaded count reaches total (e.g. 50 then 335)', () => {
    expect(
      shouldFetchMoreLoBorrowers({ loadedCount: 50, total: 335, lastPageCount: 50 })
    ).toBe(true)
    expect(
      shouldFetchMoreLoBorrowers({ loadedCount: 150, total: 335, lastPageCount: 100 })
    ).toBe(true)
    expect(
      shouldFetchMoreLoBorrowers({ loadedCount: 335, total: 335, lastPageCount: 85 })
    ).toBe(false)
  })

  it('stops when the last page is empty', () => {
    expect(
      shouldFetchMoreLoBorrowers({ loadedCount: 100, total: 335, lastPageCount: 0 })
    ).toBe(false)
  })

  it('paginates through all 335 borrowers with skip/limit pages of 100', async () => {
    const all = makeBorrowers(335)
    const calls: Array<{ skip: number; limit: number }> = []

    const result = await loadAllLoBorrowerPages({
      pageSize: 100,
      fetchPage: async ({ skip, limit }) => {
        calls.push({ skip, limit })
        return {
          total: all.length,
          borrowers: all.slice(skip, skip + limit)
        }
      }
    })

    expect(calls).toEqual([
      { skip: 0, limit: 100 },
      { skip: 100, limit: 100 },
      { skip: 200, limit: 100 },
      { skip: 300, limit: 100 }
    ])
    expect(result.pagesFetched).toBe(4)
    expect(result.total).toBe(335)
    expect(result.borrowers).toHaveLength(335)
    expect(result.borrowers[0]?.id).toBe('id-1')
    expect(result.borrowers[334]?.id).toBe('id-335')
  })

  it('does not stop at the old first-50 window', async () => {
    const all = makeBorrowers(335)
    const result = await loadAllLoBorrowerPages({
      pageSize: 50,
      fetchPage: async ({ skip, limit }) => ({
        total: all.length,
        borrowers: all.slice(skip, skip + limit)
      })
    })
    expect(result.borrowers.length).toBe(335)
    expect(result.pagesFetched).toBe(7)
  })

  it('dedupes repeated ids across pages', async () => {
    const fetchPage = vi.fn(async ({ skip }: { skip: number; limit: number }) => {
      if (skip === 0) {
        return {
          total: 3,
          borrowers: [
            { id: 'a', name: 'A', email: 'a@x.com' },
            { id: 'b', name: 'B', email: 'b@x.com' }
          ]
        }
      }
      return {
        total: 3,
        borrowers: [
          { id: 'b', name: 'B', email: 'b@x.com' },
          { id: 'c', name: 'C', email: 'c@x.com' }
        ]
      }
    })

    const result = await loadAllLoBorrowerPages({ pageSize: 2, fetchPage })
    expect(result.borrowers.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(result.total).toBe(3)
  })
})
