import { describe, expect, it } from 'vitest'
import { adminContactPageWindows } from './adminContactPageWindows'

describe('adminContactPageWindows', () => {
  it('skips whole tenants before the requested page', () => {
    expect(adminContactPageWindows([40, 10, 5], 25, 25)).toEqual([
      { index: 0, skip: 25, limit: 15 },
      { index: 1, skip: 0, limit: 10 }
    ])
  })

  it('ignores tenants with no matches', () => {
    expect(adminContactPageWindows([0, 3], 0, 25)).toEqual([{ index: 1, skip: 0, limit: 3 }])
  })

  it('returns nothing past the last contact', () => {
    expect(adminContactPageWindows([4], 10, 25)).toEqual([])
  })
})
