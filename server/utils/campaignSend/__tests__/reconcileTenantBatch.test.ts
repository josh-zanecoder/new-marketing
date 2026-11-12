import { describe, expect, it } from 'vitest'
import { takeReconcileTenantDbNameBatch } from '../reconcileTenantBatch'

describe('takeReconcileTenantDbNameBatch', () => {
  it('returns an empty list when there are no tenants', () => {
    const cursor = { index: 0 }
    expect(takeReconcileTenantDbNameBatch([], 8, cursor)).toEqual([])
    expect(cursor.index).toBe(0)
  })

  it('rotates through tenants across ticks without skipping permanently', () => {
    const names = ['a', 'b', 'c', 'd', 'e']
    const cursor = { index: 0 }

    expect(takeReconcileTenantDbNameBatch(names, 2, cursor)).toEqual(['a', 'b'])
    expect(cursor.index).toBe(2)
    expect(takeReconcileTenantDbNameBatch(names, 2, cursor)).toEqual(['c', 'd'])
    expect(cursor.index).toBe(4)
    expect(takeReconcileTenantDbNameBatch(names, 2, cursor)).toEqual(['e', 'a'])
    expect(cursor.index).toBe(1)
  })

  it('never returns more than the tenant count', () => {
    const cursor = { index: 0 }
    expect(takeReconcileTenantDbNameBatch(['only'], 8, cursor)).toEqual(['only'])
    expect(cursor.index).toBe(0)
  })
})
