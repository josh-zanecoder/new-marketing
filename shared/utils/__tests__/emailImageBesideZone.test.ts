import { describe, expect, it } from 'vitest'
import { resolveEmailImageBesideSide } from '../emailImageBesideZone'

describe('emailImageBesideZone', () => {
  const rect = { left: 100, width: 200 }

  it('splits the whole image into left/right halves by default', () => {
    expect(resolveEmailImageBesideSide(110, rect)).toBe('left')
    expect(resolveEmailImageBesideSide(199, rect)).toBe('left')
    expect(resolveEmailImageBesideSide(200, rect)).toBe('right')
    expect(resolveEmailImageBesideSide(280, rect)).toBe('right')
  })

  it('supports a narrower edge-only zone when asked', () => {
    expect(resolveEmailImageBesideSide(200, rect, 0.2)).toBeNull()
    expect(resolveEmailImageBesideSide(110, rect, 0.2)).toBe('left')
  })

  it('rejects invalid geometry', () => {
    expect(resolveEmailImageBesideSide(110, { left: 0, width: 0 })).toBeNull()
  })
})
