import { describe, expect, it } from 'vitest'
import { groupTenantHostedImagesByDay, type TenantHostedImage } from '../tenantHostedImages'

function img(partial: Partial<TenantHostedImage> & { id: string; createdAt: string }): TenantHostedImage {
  return {
    url: `https://example.com/${partial.id}.jpg`,
    objectPath: `custom-marketing/t/library/${partial.id}.jpg`,
    fileName: `${partial.id}.jpg`,
    contentType: 'image/jpeg',
    size: 100,
    ...partial
  }
}

describe('groupTenantHostedImagesByDay', () => {
  it('groups into Today / Yesterday / dated sections', () => {
    const now = new Date(2026, 10, 3, 12, 0, 0) // Nov 3, 2026 local
    const today = new Date(2026, 10, 3, 9, 0, 0).toISOString()
    const yesterday = new Date(2026, 10, 2, 18, 0, 0).toISOString()
    const earlier = new Date(2026, 9, 20, 10, 0, 0).toISOString()

    const groups = groupTenantHostedImagesByDay(
      [
        img({ id: 'a', createdAt: earlier }),
        img({ id: 'b', createdAt: today }),
        img({ id: 'c', createdAt: yesterday })
      ],
      now
    )

    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', expect.stringMatching(/Oct/)])
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['b'])
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['c'])
  })
})
