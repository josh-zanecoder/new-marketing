import { describe, expect, it } from 'vitest'
import { groupFlyersByCategory } from '../groupFlyersByCategory'

describe('groupFlyersByCategory', () => {
  it('groups flyers under named categories and uncategorized', () => {
    const groups = groupFlyersByCategory(
      [
        { id: 'f1', name: 'A', categoryId: 'c1', imageUrl: '/a.jpg' },
        { id: 'f2', name: 'B', categoryId: null, imageUrl: '/b.jpg' },
        { id: 'f3', name: 'C', categoryId: 'missing', imageUrl: '/c.jpg' }
      ],
      [
        { id: 'c2', name: 'Later', sortOrder: 2 },
        { id: 'c1', name: 'Events', sortOrder: 1 }
      ]
    )

    expect(groups.map((g) => g.label)).toEqual(['Events', 'Uncategorized'])
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['f1'])
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['f2', 'f3'])
  })

  it('omits empty named categories and empty uncategorized', () => {
    const groups = groupFlyersByCategory(
      [{ id: 'f1', name: 'A', categoryId: 'c1', imageUrl: '/a.jpg' }],
      [
        { id: 'c1', name: 'Events' },
        { id: 'c2', name: 'Bank Statement' },
        { id: 'c3', name: 'DSCR' }
      ]
    )
    expect(groups.map((g) => g.key)).toEqual(['c1'])
  })
})
